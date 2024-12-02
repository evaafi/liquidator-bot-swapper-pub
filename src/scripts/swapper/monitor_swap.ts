import {checkSwapResult} from "../../swapper/swapper";
import {getBalances, getUserWallets} from "../../lib/balances";
import {loadAddress, loadString, printProperties} from "../../lib/util";
import {configDotenv} from "dotenv";
import {Address, TonClient} from "@ton/ton";
import {ASSETS_COLLECTION_MAINNET} from "../../assets";

configDotenv();

const config = {
    rpcEndpoint: loadString('TON_RPC_ENDPOINT'),
    rpcEndpointToken: loadString('TON_RPC_TOKEN'),
    highloadAddress: loadAddress('HIGHLOAD_WALLET_ADDRESS'),
    route_id: 104445,
};

(async () => {
    console.log("START MONITORING");

    const tonClient = new TonClient({
        endpoint: config.rpcEndpoint,
        apiKey: config.rpcEndpointToken
    });

    console.log("CREATED TON CLIENT");
    const assetNamesList = ['jusdt', 'usdt'];
    const highloadAddress = Address.parse(config.highloadAddress);
    const jettonWallets = await getUserWallets(tonClient, highloadAddress, ASSETS_COLLECTION_MAINNET);

    let checkInProcess = false;
    const monitorInterval = setInterval(async () => {
        if (checkInProcess) {
            console.log("ANOTHER ROUND IS NOT FINISHED YET, WAITING MORE TIME...");
            return;
        }
        console.log("CHECKING SWAP RESULT...");
        const res = await checkSwapResult(config.route_id);
        console.log(Math.floor(Date.now() / 1000), " RES: ", res);

        const highloadBalances = await getBalances(
            tonClient, highloadAddress, ASSETS_COLLECTION_MAINNET, jettonWallets
        );
        printProperties(highloadBalances, "property");

        checkInProcess = false;
    }, 2000);

    process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        console.log("PROCESS INTERRUPTED, EXITING...");
    })
})()
