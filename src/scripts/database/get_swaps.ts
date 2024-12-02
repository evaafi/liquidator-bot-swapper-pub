import {configDotenv} from "dotenv";
import {loadString, makeTaskDescription} from "../../lib/util";
import {MyDatabase} from "../../database/database";
import {ASSETS_COLLECTION_MAINNET} from "../../assets";
import {SwapTask} from "../../database/types";


(async () => {
    configDotenv();
    const config = {
        dbPath: loadString('DB_PATH'),
    }
    const db: MyDatabase = new MyDatabase(config.dbPath);
    await db.init();
    const assetsCollection = ASSETS_COLLECTION_MAINNET;
    const makeDescription = (s: SwapTask) => makeTaskDescription(s, assetsCollection);
    console.log("STATES: ", await db.getSwapStates());
    console.log("PENDING SWAPS: ", (await db.getPendingSwaps()).map(makeDescription));
    console.log("SENT SWAPS: ", (await db.getSentSwaps()).map(makeDescription));
    console.log("PROCESSED SWAPS: ", (await db.getProcessedSwaps()).map(makeDescription));
})()
