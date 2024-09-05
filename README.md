# Asset swapper does the following:
1. Monitor db for new swap tasks
2. Do highload swaps
3. Monitors swaps states and updates swaps states in the db

# Supported assets
For now only following assets are supported:
1. TON
2. stTON
3. jUSDT
4. USDT

tsTON and jUSDC are banned, but you can easily allow them in the `config.ts` file. 

# Start and stop
The swapper service can be started by `ts-node src/index.ts`
To stop it press `Ctrl + C` or send the SIGINT signal, which is monitored and processed. 


# Environment variables

To use this service, you should create an `.env` file and place it to the project root.
It contains configuration and sensitive data as endpoints, keys, etc.
That is why it shouldn't be stored in git repository. The `.gitignore` file serves this goal.

TON_RPC_ENDPOINT= #your favorite rpc endpoint

TON_RPC_TOKEN= #access token for your rpc endpoint

TELEGRAM_BOT_TOKEN= #your bot access token

SERVICE_CHAT_ID= #telegram chat id

HIGHLOAD_WALLET_ADDRESS= #your highload v2 wallet address

HIGHLOAD_WALLET_MNEMONIC= #"put your mnemonic words here"

DB_PATH=./database-mainnet.db #path to the liquidator bot db

# Scripts
Scripts in the project are intended for deployment and debugging. They also can be used as examples.

## balances
You can use the get_balances.ts script for fetching your highload wallet balances.
To monitor them just type `watch -n 2 ts-node src/scripts/get_balances.ts`.

## database

The `add_swap_task` allows adding a new task to the database
usage: `FROM=ton TO=usdt AMOUNT=1.234 ts-node src/scripts/database/add_swap_task.ts`

The `get_swaps.ts` script prints all swaps descriptions - it is a helpful debugging tool.

## highload
The `deploy_highload_wallet` script can be used for deploying a highload wallet
