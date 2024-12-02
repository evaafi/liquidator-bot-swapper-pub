import {configDotenv} from "dotenv";
import {loadString, sleep} from "../../lib/util";
import {MyDatabase} from "../../database/database";
import {ASSETS_COLLECTION_MAINNET} from "../../assets";

export const ASSET_NAMES = [
    'ton', 'jusdc', 'jusdt', 'stton', 'tston', 'usdt',
    'tonusdt_dedust', 'tonusdt_stonfi', 'ton_storm', 'usdt_storm'
];

(async () => {
    configDotenv();
    const config = {
        dbPath: loadString('DB_PATH'),
        from: process.env.FROM,
        to: process.env.TO,
        amount: process.env.AMOUNT,
    }

    const db: MyDatabase = new MyDatabase(config.dbPath);
    await db.init();

    let assetOfferIndex = 0;
    let assetAskIndex = 0;
    while (assetOfferIndex === assetAskIndex) {
        assetOfferIndex = Math.floor(Math.random() * 1000) % ASSET_NAMES.length;
        assetAskIndex = Math.floor(Math.random() * 1000) % ASSET_NAMES.length;
    }

    console.log("ASSET_OFFER_INDEX: ", assetOfferIndex);
    console.log("ASSET_ASK_INDEX: ", assetAskIndex);

    const assetOfferName = config.from ?? ASSET_NAMES[assetOfferIndex];
    const assetAskName = config.to ?? ASSET_NAMES[assetAskIndex];
    console.log('AssetOffer name: ', assetOfferName);
    console.log('AssetAsk name: ', assetAskName);

    const assetOffer = ASSETS_COLLECTION_MAINNET.byAssetName(assetOfferName);
    const assetAsk = ASSETS_COLLECTION_MAINNET.byAssetName(assetAskName);
    console.log('Asset offer: ', assetOffer);
    console.log('Asset ask: ', assetAsk);
    const amount = assetOffer.toWei(config.amount ?? '0.5');

    console.log(`Adding task for swap ${config.amount} of ${assetOfferName} to ${assetAskName}`);
    await sleep(3000);

    // add task
    await db.addSwapTask(Date.now(), assetOffer.id, assetAsk.id, amount, '');

    console.log("TASK ADDED");
})()
