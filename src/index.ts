import {MyDatabase} from "./database/database";
import {Address, Dictionary, TonClient} from "@ton/ton";
import {configDotenv} from "dotenv";
import {mnemonicToWalletKey} from "@ton/crypto";
import {loadAddress, loadString, makeTaskDescription, sleep} from "./lib/util";
import {checkSwapResult, highloadExchange} from "./swapper/swapper";
import {HighloadExchangeResult, SwapParams} from "./swapper/types";
import {TransactionStatus} from "./swapper/helpers";
import {clearInterval} from "node:timers";
import {HighloadWalletV2} from "./lib/highload_contract_v2";
import {SwapTask} from "./database/types";
import {ChannelMessenger, logMessage, Messenger, TopicMessenger} from "./lib/messenger";

import {ASSETS_COLLECTION_MAINNET} from "./assets";
import {getSwapLimits, SUPPORTED_ASSET_IDS} from "./config";
import {AssetsCollection} from "./lib/assets_collection";
import {checkEligibleSwapTask, formatSwapCanceledMessage, unpackPrices} from "./helpers";
import {Cell} from "@ton/core";
import {retry} from "./lib/retry";

/**
 * Entry point of the swapper service
 */

configDotenv();

const config = {
    rpc: {
        endpoint: loadString('TON_RPC_ENDPOINT'),
        token: loadString('TON_RPC_TOKEN'),
    },
    bot: {
        token: loadString('TELEGRAM_BOT_TOKEN'),
        chatId: loadString('SERVICE_CHAT_ID'),
        topicId: process.env.TELEGRAM_TOPIC_ID, // no check
    },
    wallet: {
        address: loadAddress('HIGHLOAD_WALLET_ADDRESS'),
        mnemonic: loadString('HIGHLOAD_WALLET_MNEMONIC'),
    },
    db: {
        path: loadString('DB_PATH'),
    },
    swapper: {
        serviceInterval: 5_000,
        swapWaitInterval: 450,
        // maxSlippage: MAX_SLIPPAGE.PP_03,    // 3%
        maxSlippage: undefined, // to use jettons-based logic
        maxSwapsPerTact: 10,
    },
    tracker: {
        maxTracksPerTact: 10,
        serviceInterval: 5_100,
    },
    maintenance: {
        serviceInterval: 300_000, // 5 minutes
    },
    prefix: {
        service: "ASSET SWAPPER SERVICE: ",
        tracker: "TRACKER: ",
        swapper: "SWAPPER: ",
        maintenance: "MAINTENANCE: ",
    },
    referral: {
        token: 'evaa',
    }
}

const isAssetSupported = (assetId: bigint) => {
    if (!ASSETS_COLLECTION_MAINNET.byAssetId(assetId)) return false;
    return SUPPORTED_ASSET_IDS.findIndex(id => id === assetId) >= 0;
}

async function serveSingleSwap(task: SwapTask,
                               wallet: HighloadWalletV2, db: MyDatabase, messenger: Messenger,
                               assetsCollection: AssetsCollection
) {
    const swapDescription = makeTaskDescription(task, assetsCollection);
    for (const assetId of [task.tokenOffer, task.tokenAsk]) {
        if (!isAssetSupported(assetId)) {
            const message = `Jetton ID ${assetId} is not supported, swap canceled`;
            console.warn(swapDescription);
            logMessage(message);
            await db.cancelTask(task.id);
            await messenger.sendMessage([swapDescription, message].join('\n'));
            return;
        }
    }

    const assetOffer = assetsCollection.byAssetId(task.tokenOffer);
    const assetAsk = assetsCollection.byAssetId(task.tokenAsk);

    // don't check if no prices are provided
    const shouldCheckValueThreshold = typeof task.pricesCell === 'string' && task.pricesCell.length > 0;
    if (!shouldCheckValueThreshold) {
        logMessage(`${config.prefix.swapper}: Swap value will not be checked`);
    }

    let prices: Dictionary<bigint, bigint> = Dictionary.empty<bigint, bigint>();
    if (shouldCheckValueThreshold) {
        try {
            prices = unpackPrices(Cell.fromBase64(task.pricesCell))
        } catch (e) {
            logMessage(`${config.prefix.swapper}: FAILED TO UNPACK PRICES for task ID ${task.id}`);
            console.error(e);
        }
    }

    // check swap eligibility
    let shouldSwap = await checkEligibleSwapTask(assetOffer, task.swapAmount, assetAsk, prices);
    if (!shouldSwap) {
        await db.cancelTask(task.id);
        await messenger.sendMessage(formatSwapCanceledMessage(assetOffer, assetAsk, task.swapAmount));
        return;
    }

    const limits = getSwapLimits(task.tokenOffer, task.tokenAsk);

    const swapParams: SwapParams = {
        tokenOffer: assetOffer.address.toString(),
        tokenAsk: assetAsk.address.toString(),
        swapAmount: assetOffer.fromWei(task.swapAmount),
        maxSlippage: config.swapper.maxSlippage ?? limits.max_slippage,
        maxLength: limits.max_swap_length,
        referralName: config.referral.token,
    }

    await messenger.sendMessage(`Pending swap received: ${swapDescription}`);
    logMessage(`${config.prefix.swapper} Pending swap received: ${swapDescription}`);

    let res = await retry<HighloadExchangeResult>(
        async () => await highloadExchange(wallet, swapParams),
        {attempts: 10, attemptInterval: 1000}
    );

    if (!res.ok) {
        const message = `${config.prefix.swapper} Failed to send swap messages for: ${swapDescription}`;
        logMessage(message);
        await messenger.sendMessage(message);
        await db.failTask(task.id, TransactionStatus.Failed);
        return;
    }

    await db.takeSwapTask(task.id, res.value.query_id!, res.value.route_id!);
}

async function serveSwaps(wallet: HighloadWalletV2, db: MyDatabase, messenger: Messenger, assetsCollection: AssetsCollection) {
    const tasks = await db.getPendingSwaps(config.swapper.maxSwapsPerTact);
    if (tasks.length === 0) {
        return;
    }

    for (const task of tasks) {
        try {
            await serveSingleSwap(task, wallet, db, messenger, assetsCollection);
        } catch (e) {
            const taskDescription = makeTaskDescription(task, assetsCollection);
            const message = `${config.prefix.swapper} Swap failed: ${taskDescription}`;
            console.warn(e);
            logMessage(message);
            await messenger.sendMessage(message);
        }

        await sleep(config.swapper.swapWaitInterval);
    }
}

async function serveTracker(db: MyDatabase, messenger: Messenger, assetsCollection: AssetsCollection) {
    const swaps = await db.getSentSwaps(config.tracker.maxTracksPerTact);
    if (swaps.length === 0) {
        return;
    }

    const results = await Promise.all(swaps.map(swap => checkSwapResult(swap.routeID)));

    for (const [index, res] of results.entries()) {
        const task = swaps[index];
        const swapDescription = makeTaskDescription(task, assetsCollection);

        if ((res & TransactionStatus.InProcess) !== 0) {
            logMessage(`${config.prefix.tracker} ${swapDescription}  is still in progress, waiting more...`);
            continue; // for readability
        }

        if (res === TransactionStatus.Succeeded) { // swap finished, full success
            const message = `${config.prefix.tracker} ${swapDescription} has succeeded!`;
            logMessage(message);
            await messenger.sendMessage(message);
            await db.succeedTask(task.id, TransactionStatus.Succeeded);
            continue;
        }

        if ((res & TransactionStatus.PartiallyComplete) !== 0) { // partial success, some failed or timed out
            const message = `${config.prefix.tracker} ${swapDescription} has partially succeeded!`;
            logMessage(message);
            await messenger.sendMessage(message);
            await db.succeedTask(task.id, res); // discussible, what status it should become
            continue;
        }

        if ((res & TransactionStatus.TimedOut) !== 0) { // timeout or partially fail
            const message = `${config.prefix.tracker} ${swapDescription} has timed out!`;
            logMessage(message);
            await messenger.sendMessage(message);
            await db.timeoutTask(task.id, res);
            continue;
        }

        if ((res & (TransactionStatus.Failed | TransactionStatus.Unknown)) !== 0) {
            const message = `${config.prefix.tracker} ${swapDescription} has failed!`;
            logMessage(message);
            await messenger.sendMessage(message);
            await db.failTask(task.id, res);
        }
    }
}

async function main(messenger: Messenger, assetsCollection: AssetsCollection, supportedAssetIds: bigint[]) {
    const db = new MyDatabase(config.db.path);
    await db.init();

    const tonClient = new TonClient({
        endpoint: config.rpc.endpoint,
        apiKey: config.rpc.token
    });

    const highloadAddress = Address.parse(config.wallet.address);
    const keys = await mnemonicToWalletKey(config.wallet.mnemonic.split(' '));

    const wallet = new HighloadWalletV2(tonClient, highloadAddress, keys);
    await sleep(1000);

    logMessage(`Starting monitoring service...`);

    const supportedAssetsInfos = supportedAssetIds
        .map((assetId) => assetsCollection.byAssetId(assetId))
        .filter(id => id !== undefined);

    const supportedAssetsNames = supportedAssetsInfos.map(asset => asset.symbol);
    await messenger.sendMessage(`Starting asset swapper, supported assets are: [${supportedAssetsNames.join(', ')}]`);

    let trackingInProgress = false;

    const trackingIntervalID = setInterval(async () => {
        if (trackingInProgress) {
            logMessage(`${config.prefix.tracker}: Previous run is still in progress, waiting...`);
            return;
        }
        trackingInProgress = true;
        try {
            await serveTracker(db, messenger, assetsCollection);
        } catch (e) {
            const message = `${config.prefix.tracker}: Service has failed`;
            console.warn(e);
            logMessage(message);
            await messenger.sendMessage(message);
        }
        trackingInProgress = false;
    }, config.tracker.serviceInterval);

    logMessage('Starting swapper service...');
    let swapInProgress = false;

    const swapServiceIntervalID = setInterval(async () => {
        if (swapInProgress) {
            logMessage(`${config.prefix.swapper}: Previous run is not finished, wait more...`);
            return;
        }

        swapInProgress = true;
        try {
            await serveSwaps(wallet, db, messenger, assetsCollection);
        } catch (e) {
            const message = `${config.prefix.swapper} Service has failed: `;
            console.warn(e);
            logMessage(message);
            await messenger.sendMessage(message);
        }
        swapInProgress = false;

    }, config.swapper.serviceInterval);

    // // disable for now
    // console.log('Starting maintenance service...');
    // let maintenanceInProgress = false;
    // const maintenanceIntervalID = setInterval(async () => {
    //     if (maintenanceInProgress) {
    //         console.log(config.prefix.maintenance, 'Previous run is not finished, wait more...');
    //         return;
    //     }
    //     maintenanceInProgress = true;
    //     try {
    //         await db.deleteOldSwaps();
    //     } catch (e) {
    //         const message = `${config.prefix.maintenance} Service has failed: `;
    //         console.warn(message, e);
    //         messenger.sendMessage(message);
    //     }
    // });

    // handle interruption Ctrl+C === SIGINT
    let interruptCalledOnce = false;
    process.on('SIGINT', async () => {
        if (interruptCalledOnce) throw ('Quitting immediately...');

        const message = `Received SIGINT, stopping services...`;
        logMessage(message);
        await messenger.sendMessage(message);
        clearInterval(swapServiceIntervalID);
        clearInterval(trackingIntervalID);
        // clearInterval(maintenanceIntervalID);
        logMessage('Waiting 10s before forcing exit...');

        setTimeout(() => {
            interruptCalledOnce = true;
            throw ('Forced exit...');
        }, 10_000); // wait 10 seconds for `threads` to finish, then enforce exit
    });

    // await messenger.sendMessage('Services started');
}

(async () => {
    const {token, chatId, topicId} = config.bot;
    const messenger = (!config.bot.topicId) ?
        new ChannelMessenger(token, chatId) : new TopicMessenger(token, chatId, topicId);

    // await messenger.sendMessage('Asset swapper service is starting...');
    main(messenger, ASSETS_COLLECTION_MAINNET, SUPPORTED_ASSET_IDS)
        .catch(async e => {
            logMessage(`${e}`);
            if (JSON.stringify(e).length == 2) {
                await messenger.sendMessage(`Fatal error: ${e}`);
                return;
            }
            await messenger.sendMessage(`Fatal error: ${JSON.stringify(e).slice(0, 300)} `);
        });
})()
