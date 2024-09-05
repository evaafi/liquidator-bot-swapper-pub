import {
    Address,
    beginCell,
    internal,
    OpenedContract,
    storeStateInit,
    toNano,
    TonClient,
    WalletContractV4
} from "@ton/ton";
import {KeyPair, mnemonicToWalletKey} from "@ton/crypto";
import {configDotenv} from "dotenv";

import {bufferToBigInt, loadString, sleep} from "../../util";

import {HIGHLOAD_CODE_V2, SUBWALLET_ID} from "../../config";

async function deployHighload(client: TonClient, wallet: OpenedContract<WalletContractV4>, subwallet_id: number, keys: KeyPair) {

    const dataCell = beginCell()
        .storeUint(subwallet_id, 32)
        .storeUint(0, 64)
        .storeBuffer(keys.publicKey)
        .storeBit(0)
        .endCell();

    const stateInit = beginCell().store(storeStateInit({
        code: HIGHLOAD_CODE_V2,
        data: dataCell
    })).endCell();

    const highloadAddress = new Address(0, stateInit.hash());
    await wallet.sendTransfer({
        seqno: await wallet.getSeqno(),
        secretKey: keys.secretKey,
        messages: [internal({
            to: highloadAddress,
            value: toNano('0.02'),
            init: {
                code: HIGHLOAD_CODE_V2,
                data: dataCell
            }
        })]
    });

    let attempts = 0;
    while (true) {
        try {
            const getData = await client.runMethod(highloadAddress, 'get_public_key');
            if (getData.stack.readBigNumber() === bufferToBigInt(keys.publicKey)) break;
        } catch {
            attempts++;
            if (attempts === 5) {
                throw new Error('Highload contract deploy failed');
            }
            await sleep(5000);
        }
    }

    console.log(`Highload contract deployed: ${highloadAddress.toString({
        testOnly: process.env.IS_TESTNET === 'true'
    })}`);
}

(async () => {
    configDotenv();

    const config = {
        mnemonic: loadString('HIGHLOAD_WALLET_MNEMONIC'),
        rpcEndpoint: loadString('TON_RPC_ENDPOINT'),
        rpcEndpointToken: loadString('TON_RPC_TOKEN'),
        subwalletId: Number(process.env.SUBWALLET_ID ?? SUBWALLET_ID),
    }

    const tonClient = new TonClient({
        endpoint: config.rpcEndpoint,
        apiKey: config.rpcEndpointToken
    });

    const keypair = await mnemonicToWalletKey(config.mnemonic.split(' '));

    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: Buffer.from((keypair).publicKey)
    });

    const walletContract = tonClient.open(wallet);
    console.log("Wallet address:", walletContract.address.toString({
        testOnly: process.env.IS_TESTNET === 'true',
    }));

    deployHighload(
        tonClient,
        walletContract,
        config.subwalletId,
        keypair
    ).catch(e => {
            console.log(e);
        }
    ).finally(() => console.log("Exiting..."));
})()
