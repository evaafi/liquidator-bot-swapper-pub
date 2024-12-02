import {configDotenv} from "dotenv";
import {loadString} from "../../lib/util";
import {MyDatabase} from "../../database/database";


(async () => {
    configDotenv();
    const config = {
        dbPath: loadString('DB_PATH'),
    }

    const db: MyDatabase = new MyDatabase(config.dbPath);
    await db.init();

    const swaps = await db.getPendingSwaps(1);
    if (!Array.isArray((swaps)) || swaps.length === 0) {
        console.warn("No swap tasks, exiting...");
        return;
    }

    const task = swaps[0];
    console.log("TASK: ", task);

    await db.takeSwapTask(task.id, 123n, 456);
})()
