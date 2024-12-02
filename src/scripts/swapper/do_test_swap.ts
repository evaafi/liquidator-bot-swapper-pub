/**
 * This code makes a swap of tokens in provided highload wallet
 */
import {configDotenv} from "dotenv";
import {loadAddress, loadString, printProperties} from "../../lib/util";
import {mnemonicToWalletKey} from "@ton/crypto";
import {Address, TonClient} from "@ton/ton";
import {checkSwapResult, highloadExchange} from "../../swapper/swapper";
import {HighloadExchangeResult, SwapParams} from "../../swapper/types";
import {getBalances, getUserWallets} from "../../lib/balances";
import {HighloadWalletV2} from "../../lib/highload_contract_v2";
import {getSwapLimits, MAX_SLIPPAGE} from "../../config";
import {ASSET_ID, ASSETS_COLLECTION_MAINNET} from "../../assets";

configDotenv();

const config = {
    rpcEndpoint: loadString('TON_RPC_ENDPOINT'),
    rpcEndpointToken: loadString('TON_RPC_TOKEN'),
    walletMnemonic: loadString('HIGHLOAD_WALLET_MNEMONIC'),
    highloadAddress: loadAddress('HIGHLOAD_WALLET_ADDRESS'),

    assetOfferId: ASSET_ID.jusdt,
    assetAskId: ASSET_ID.usdt,
    swapAmount: 1,
    maxSlippage: MAX_SLIPPAGE.PP_03,
};

(async () => {
    console.log("START SWAP DEMONSTRATION");

    const tonClient = new TonClient({
        endpoint: config.rpcEndpoint,
        apiKey: config.rpcEndpointToken
    });

    console.log("CREATED TON CLIENT");

    // === FETCH MESSAGES ===
    console.log("START HIGHLOAD EXCHANGE");

    const keys = await mnemonicToWalletKey(config.walletMnemonic.split(' '));
    const highloadAddress = Address.parse(config.highloadAddress);
    const highloadContract = new HighloadWalletV2(tonClient, highloadAddress, keys);

    const assetsCollection = ASSETS_COLLECTION_MAINNET;
    const limits = getSwapLimits(config.assetOfferId, config.assetAskId);
    const getAssetAddress = (assetId: bigint): string => assetsCollection.byAssetId(assetId).address.toString();
    const assetOfferAddress = getAssetAddress(config.assetOfferId);
    const assetAskAddress = getAssetAddress(config.assetAskId);

    const swapParams: SwapParams = {
        tokenOffer: assetOfferAddress.toString(),
        tokenAsk: assetAskAddress,
        swapAmount: config.swapAmount,
        maxSlippage: config.maxSlippage ?? limits.max_slippage,
        maxLength: limits.max_swap_length
    }

    // can throw
    const res: HighloadExchangeResult = await highloadExchange(highloadContract, swapParams);
    const {route_id, query_id} = res;

    console.log(`ROUTE_ID: ${route_id}, QUERY_ID: ${query_id}`);
    const _route_id: number = parseInt(route_id.toString());
    const assetList = ['jusdt', 'usdt'];
    const jettonWallets = await getUserWallets(tonClient, highloadAddress, assetsCollection);

    // === MONITOR SWAP TRANSACTIONS ===
    let checkInProcess = false;
    const monitorInterval = setInterval(async () => {
        if (checkInProcess) {
            console.log("ANOTHER ROUND IS NOT FINISHED YET, WAITING MORE TIME...");
            return;
        }
        console.log("CHECKING SWAP RESULT...");
        const res = await checkSwapResult(_route_id);
        console.log(Math.floor(Date.now() / 1000), " RES: ", res);

        const highloadBalances = await getBalances(
            tonClient, highloadAddress, assetsCollection, jettonWallets
        );

        printProperties(highloadBalances, "property ");

        checkInProcess = false;
    }, 2000);

    process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        console.log("PROCESS INTERRUPTED, EXITING...");
    })
})()
