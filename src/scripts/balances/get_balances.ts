import {configDotenv} from "dotenv";
import {loadString, printBalances} from "../../util";
import {Address, TonClient} from "@ton/ton";
import {getBalances, getUserWallets, normalizeBalances} from "../../balances";
import {ASSETS_COLLECTION_MAINNET, EXTENDED_ASSETS_COLLECTION_MAINNET} from "../../assets";

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

    const highloadAddress: Address = Address.parse(config.highloadAddress);

    const wallets = await getUserWallets(tonClient, highloadAddress, assetsCollection);
    // assetsCollection.ids().forEach((id) => {
    //     const asset = assetsCollection.byAssetId(id);
    //     const wallet = asset.symbol === 'TON' ? 'native' : wallets.get(id);
    //     console.log(asset.symbol, id, wallet);
    // });

    const highloadBalances = await getBalances(tonClient, highloadAddress, assetsCollection, wallets);

    console.log("=== WALLET BALANCES ===");
    printBalances(highloadBalances, assetsCollection);

    console.log("=== NORMALIZED BALANCES ===");
    const normalizedBalances = normalizeBalances(highloadBalances, assetsCollection);
    printBalances(normalizedBalances, assetsCollection);
})()
