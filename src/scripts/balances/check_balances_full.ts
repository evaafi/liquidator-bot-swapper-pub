import {configDotenv} from "dotenv";
import {loadString, printBalances, printProperties} from "../../lib/util";
import {Address, TonClient} from "@ton/ton";
import {EXTENDED_ASSET_LIST} from "../../config";
import {ASSETS_COLLECTION_MAINNET, JETTON_MASTERS_MAINNET} from '../../assets';
import {getBalances, getUserWallet, normalizeBalances} from "../../lib/balances";

/**
 * This code has no side effects, feel free to run this demonstration
 */
(async () => {
    configDotenv();

    const config: Record<string, string> = {
        tonRpcEndpoint: loadString('TON_RPC_ENDPOINT'),
        tonRpcToken: loadString('TON_RPC_TOKEN'),
        highloadAddress: loadString('HIGHLOAD_WALLET_ADDRESS'),
    };

    const tonClient = new TonClient({
        endpoint: config.tonRpcEndpoint,
        apiKey: config.tonRpcToken
    });

    const assetsCollection = ASSETS_COLLECTION_MAINNET;
    const assetsList = EXTENDED_ASSET_LIST;
    const jettonMasters = JETTON_MASTERS_MAINNET;
    const highloadAddress: Address = Address.parse(config.highloadAddress);

    if (true) {
        console.log("=== MASTER JETTONS ===");

        assetsList.forEach(asset => {
            console.log(`Master contract ${asset}: \t${jettonMasters[asset]}`);
        });

        console.log("");
        console.log("=== JETTON WALLETS === ");

        const userWallets = await Promise.all(
            assetsList.map(assetName => getUserWallet(tonClient, jettonMasters[assetName], highloadAddress))
        );

        assetsList.forEach((assetName, index) => {
            console.log(`Jetton wallet ${assetName}: \t${userWallets[index]}`);
        });

        console.log("");
        console.log("=== WALLET BALANCES ===");

        const highloadBalances = await getBalances(tonClient, highloadAddress, assetsCollection);
        printBalances(highloadBalances, assetsCollection);

        console.log("=== NORMALIZED BALANCES ===");
        const normalizedBalances = normalizeBalances(highloadBalances, assetsCollection);
        printBalances(normalizedBalances, assetsCollection);
    }
})()
