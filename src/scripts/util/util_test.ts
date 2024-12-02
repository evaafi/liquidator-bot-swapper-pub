import {retry} from "../../lib/retry";

(async () => {
    {
        let attempts = 3;
        const res = await retry(async (): Promise<number> => {
            if (attempts-- > 0) throw new Error(`Throw attempts left: ${attempts}`);
            return Promise.resolve(1);
        },
            {
                attempts: 4,
                attemptInterval: 100,
                verbose: false,
                on_fail: () => console.log("FAILED!!!"),
            }
        );

        console.log("res = ", res);
    }
    {
        let attempts = 3;
        const res = await retry(async (): Promise<number> => {
            if (attempts-- > 0) throw new Error(`Throw attempts left: ${attempts}`);
            return Promise.resolve(1);
        },
            {
                attempts: 4,
                attemptInterval: 100,
                verbose: false,
            }
        );

        console.log("res = ", res);
    }
    {
        let attempts = 3;
        const res = await retry(async (): Promise<number> => {
            if (attempts-- > 0) throw new Error(`Throw attempts left: ${attempts}`);
            return Promise.resolve(1);
        },
            {
                attempts: 4,
                attemptInterval: 100,
            }
        );

        console.log("res = ", res);
    }
    {
        let attempts = 3;
        const res = await retry(async (): Promise<number> => {
            if (attempts-- > 0) throw new Error(`Throw attempts left: ${attempts}`);
            return Promise.resolve(1);
        },
            {
                attempts: 4,
            }
        );

        console.log("res = ", res);
    }
    {
        let attempts = 3;
        const res = await retry(async (): Promise<number> => {
            if (attempts-- > 0) throw new Error(`Throw attempts left: ${attempts}`);
            return Promise.resolve(1);
        });

        console.log("res = ", res);
    }
})()
