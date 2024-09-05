import {MyDatabase} from "./database/database";
import {Address, TonClient} from "@ton/ton";
import {configDotenv} from "dotenv";
import {mnemonicToWalletKey} from "@ton/crypto";
import {isDefined, loadAddress, loadString, makeTaskDescription, retry, sleep} from "./util";
import {checkSwapResult, highloadExchange} from "./swapper/swapper";
import {HighloadExchangeResult, SwapParams} from "./swapper/types";
import {TransactionStatus} from "./swapper/helpers";
import {clearInterval} from "node:timers";
import {HighloadWalletV2} from "./highload/highload_contract";
import {SwapTask} from "./database/types";
import {ServiceBot} from "./bot/service_bot";

import {ASSETS_COLLECTION_MAINNET} from "./assets";
import {getSwapLimits, SUPPORTED_ASSETS} from "./config";
import {AssetsCollection} from "./assets_collection";

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
        chatId: parseInt(loadString('SERVICE_CHAT_ID')),
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
}

const isAssetSupported = (assetId: bigint) => {
    const asset = ASSETS_COLLECTION_MAINNET.byAssetId(assetId);
    if (!isDefined(asset)) return false;
    return SUPPORTED_ASSETS.findIndex(assetSymbol => assetSymbol === asset?.symbol) >= 0; // found
}

async function doSingleSwap(task: SwapTask, wallet: HighloadWalletV2, db: MyDatabase, bot: ServiceBot, assetsCollection: AssetsCollection) {
    for (const assetId of [task.tokenOffer, task.tokenAsk]) {
        if (!isAssetSupported(assetId)) {
            const message = `Jetton ID ${assetId} is not supported`;
            console.warn(message);
            await db.cancelTask(task.id);
            await bot.sendMessage(message);
            return;
        }
    }

    const limits = getSwapLimits(task.tokenOffer, task.tokenAsk);
    const assetOffer = ASSETS_COLLECTION_MAINNET.byAssetId(task.tokenOffer);
    const assetAsk = ASSETS_COLLECTION_MAINNET.byAssetId(task.tokenAsk);

    const swapParams: SwapParams = {
        tokenOffer: assetOffer.address.toString(),
        tokenAsk: assetAsk.address.toString(),
        swapAmount: assetOffer.fromWei(task.swapAmount),
        maxSlippage: config.swapper.maxSlippage ?? limits.max_slippage,
        maxLength: limits.max_swap_length
    }

    const swapDescription = makeTaskDescription(task, assetsCollection);
    await bot.sendMessage(`Pending swap received: ${swapDescription}`);
    console.log(`${config.prefix.swapper} Pending swap received: ${swapDescription}`);

    let res = await retry<HighloadExchangeResult>(
        async () => await highloadExchange(wallet, swapParams),
        {attempts: 3, attemptInterval: 1000}
    );

    if (!res.ok) {
        const message = `${config.prefix.swapper} Failed to send swap messages for: ${swapDescription}`;
        console.warn(message);
        await bot.sendMessage(message);
        await db.failTask(task.id, TransactionStatus.Failed);
        return;
    }

    await db.takeSwapTask(task.id, res.value.query_id, res.value.route_id);
}

async function serveSwaps(wallet: HighloadWalletV2, db: MyDatabase, bot: any, assetsCollection: AssetsCollection) {
    const tasks = await db.getPendingSwaps(config.swapper.maxSwapsPerTact);
    if (tasks.length === 0) {
        //console.log(config.prefix.swapper, 'No swap tasks, waiting...');
        return;
    }

    for (const task of tasks) {
        try {
            await doSingleSwap(task, wallet, db, bot, assetsCollection);
        } catch (e) {
            const taskDescription = makeTaskDescription(task, assetsCollection);
            const message = `${config.prefix.swapper} Single swap failed: ${taskDescription}`;
            console.warn(message, e);
            bot.sendMessage(message);
        }

        await sleep(config.swapper.swapWaitInterval);
    }
}

async function serveTracker(db: MyDatabase, bot: any, assetsCollection: AssetsCollection) {
    const swaps = await db.getSentSwaps(config.tracker.maxTracksPerTact);
    if (swaps.length === 0) {
        //console.log(`${config.prefix.tracker} Nothing to track, waiting...`);
        return;
    }

    const results = await Promise.all(swaps.map(swap => checkSwapResult(swap.routeID)));

    for (const [index, res] of results.entries()) {
        const task = swaps[index];
        const swapDescription = makeTaskDescription(task, assetsCollection);

        if ((res & TransactionStatus.InProcess) !== 0) {
            console.log(`${config.prefix.tracker} Swap ${swapDescription}  is still in progress, waiting more...`);
            continue; // for readability
        }

        if (res === TransactionStatus.Succeeded) { // swap finished, full success
            bot.sendMessage(`${config.prefix.tracker} Swap task ${swapDescription} has succeeded!`);
            await db.succeedTask(task.id, TransactionStatus.Succeeded);
            continue;
        }

        if ((res & TransactionStatus.Succeeded) !== 0) { // partial success, some failed or timed out
            bot.sendMessage(`${config.prefix.tracker} Swap task ${swapDescription} has partially succeeded!`);
            await db.succeedTask(task.id, res); // discussible, what status it should become
            continue;
        }

        if ((res & TransactionStatus.TimedOut) !== 0) { // timeout or partially fail
            bot.sendMessage(`${config.prefix.tracker} Swap task ${swapDescription} has timed out!`);
            await db.timeoutTask(task.id, res);
            continue;
        }

        if ((res & (TransactionStatus.Failed | TransactionStatus.Unknown)) !== 0) {
            bot.sendMessage(`${config.prefix.tracker} Swap task ${swapDescription} has failed!`);
            await db.failTask(task.id, res);
        }
    }
}

async function main(bot: any, assetsCollection: AssetsCollection) {
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

    console.log("Starting monitoring service...");
    let trackingInProgress = false;

    const trackingIntervalID = setInterval(async () => {
        if (trackingInProgress) {
            console.log(config.prefix.tracker, 'Previous run is still in progress, waiting...');
            return;
        }
        trackingInProgress = true;
        try {
            await serveTracker(db, bot, assetsCollection);
        } catch (e) {
            const message = `${config.prefix.tracker}: Service has failed`;
            console.warn(message, e);
            bot.sendMessage(message);
        }
        trackingInProgress = false;
    }, config.tracker.serviceInterval);

    console.log('Starting swap service...');
    let swapInProgress = false;

    const swapServiceIntervalID = setInterval(async () => {
        //console.log(config.prefix.swapper, 'Start processing swap tasks...');
        if (swapInProgress) {
            console.log(config.prefix.swapper, 'Previous run is not finished, wait more...');
            return;
        }

        swapInProgress = true;
        try {
            await serveSwaps(wallet, db, bot, assetsCollection);
        } catch (e) {
            const message = `${config.prefix.swapper} Service has failed: `;
            console.warn(message, e);
            bot.sendMessage(message);
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
    //         bot.sendMessage(message);
    //     }
    // });

    // handle interruption Ctrl+C === SIGINT
    process.on('SIGINT', async () => {
        const message = `Received SIGINT, stopping services...`;
        console.log(message);
        await bot.sendMessage(message);
        clearInterval(swapServiceIntervalID);
        clearInterval(trackingIntervalID);
        // clearInterval(maintenanceIntervalID);
        console.log('Waiting 20s before force exit...');

        setTimeout(() => {
            throw ('Forced exit...');
        }, 20_000); // wait 10 seconds for `threads` to finish, then enforce exit
    });

    await bot.sendMessage('Services started');
}

(async () => {
    // const bot = (config.isTestMode) ? new FakeBot() : new Bot(config.telegramBotToken);
    const bot = new ServiceBot(config.bot.token, config.bot.chatId);
    await bot.sendMessage('Asset swapper service is starting...');
    const assetsCollection = ASSETS_COLLECTION_MAINNET;
    main(bot, assetsCollection)
        .catch(async e => {
            console.log(e);
            if (JSON.stringify(e).length == 2) {
                await bot.sendMessage(`Fatal error: ${e}`);
                return;
            }
            await bot.sendMessage(`Fatal error: ${JSON.stringify(e).slice(0, 300)} `);
        });
})()
