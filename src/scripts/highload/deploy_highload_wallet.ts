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

import {bufferToBigInt, loadString, sleep} from "../../lib/util";
import {Cell} from "@ton/core";

export const SUBWALLET_ID = 698983191;
export const HIGHLOAD_CODE_V2 = Cell.fromBase64('te6ccgEBCQEA5QABFP8A9KQT9LzyyAsBAgEgAgMCAUgEBQHq8oMI1xgg0x/TP/gjqh9TILnyY+1E0NMf0z/T//QE0VNggED0Dm+hMfJgUXO68qIH+QFUEIf5EPKjAvQE0fgAf44WIYAQ9HhvpSCYAtMH1DAB+wCRMuIBs+ZbgyWhyEA0gED0Q4rmMQHIyx8Tyz/L//QAye1UCAAE0DACASAGBwAXvZznaiaGmvmOuF/8AEG+X5dqJoaY+Y6Z/p/5j6AmipEEAgegc30JjJLb/JXdHxQANCCAQPSWb6VsEiCUMFMDud4gkzM2AZJsIeKz');

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
