import {configDotenv} from "dotenv";
import {loadString, printBalances} from "../../lib/util";
import {Address, TonClient} from "@ton/ton";
import {getBalances, getUserWallets, normalizeBalances} from "../../lib/balances";
import {ASSET_ID, ASSETS_COLLECTION_MAINNET} from "../../assets";
// import {getPrices, MAINNET_POOL_CONFIG} from "@evaafi/sdk";

/**
 * This code has no side effects, feel free to run this demonstration
 */
(async () => {
    configDotenv();
    console.log('ASSET IDS:');
    Object.entries(ASSET_ID).forEach(([k, v]) => {
        console.log(k, v, Buffer.from(v.toString(16)).toString('base64'));
    })
    // return;

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

    // const highloadAddress: Address = Address.parse(config.highloadAddress);

    const highloadAddress = Address.parse('EQBOk2af_LlGSAoPq9-ns17F2t18m8nHPhhDOuYYat9a4cau'); // evaa+v5+lp

    const wallets = await getUserWallets(tonClient, highloadAddress, assetsCollection);
    assetsCollection.ids().forEach((id) => {
        const asset = assetsCollection.byAssetId(id);
        const wallet = asset.symbol === 'TON' ? 'native' : wallets.get(id);
        console.log(asset.symbol, id, wallet);
    });

    const highloadBalances = await getBalances(tonClient, highloadAddress, assetsCollection, wallets);

    // const pricesRes = await retry(
    //     async () => await getPrices([
    //             'evaa.space', 'iota.evaa.finance',
    //             'api.stardust-mainnet.iotaledger.net'
    //         ], MAINNET_POOL_CONFIG
    //     ), {attempts: 10, attemptInterval: 1000}
    // );
    //
    // if (!pricesRes.ok) throw (`Failed to fetch prices`);
    // const {dict: prices} = pricesRes.value;

    console.log("=== WALLET BALANCES ===");
    printBalances(highloadBalances, assetsCollection);

    console.log("=== NORMALIZED BALANCES ===");
    const normalizedBalances = normalizeBalances(highloadBalances, assetsCollection);
    // printBalances(normalizedBalances, assetsCollection, prices);
    printBalances(normalizedBalances, assetsCollection);
})()
