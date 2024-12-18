import {Address, beginCell, Cell, ContractProvider, Dictionary, TonClient} from "@ton/ton";
import {KeyPair, sign} from "@ton/crypto";
import {retry} from "./retry";
import crypto from "crypto";

const HIGHLOAD_CODE_V2: Cell = Cell.fromBase64('te6ccgEBCQEA5QABFP8A9KQT9LzyyAsBAgEgAgMCAUgEBQHq8oMI1xgg0x/TP/gjqh9TILnyY+1E0NMf0z/T//QE0VNggED0Dm+hMfJgUXO68qIH+QFUEIf5EPKjAvQE0fgAf44WIYAQ9HhvpSCYAtMH1DAB+wCRMuIBs+ZbgyWhyEA0gED0Q4rmMQHIyx8Tyz/L//QAye1UCAAE0DACASAGBwAXvZznaiaGmvmOuF/8AEG+X5dqJoaY+Y6Z/p/5j6AmipEEAgegc30JjJLb/JXdHxQANCCAQPSWb6VsEiCUMFMDud4gkzM2AZJsIeKz');
const ATTEMPTS_NUMBER: number = 3;
const ATTEMPTS_INTERVAL: number = 1000;

export function makeQueryId(): bigint {
    const queryID = crypto.randomBytes(4).readUint32BE();
    const now = Math.floor(Date.now() / 1000);
    const timeout = 60;
    const finalQueryID = (BigInt(now + timeout) << 32n) + BigInt(queryID);

    return finalQueryID;
}

export class HighloadWalletV2 {
    _tonClient: TonClient;
    _address: Address;
    _keys: KeyPair;
    _subwalletId: bigint;
    _contract: ContractProvider;

    constructor(tonClient: TonClient, highloadAddress: Address, keys: KeyPair, subwalletId: bigint = 698983191n) {
        this._tonClient = tonClient;
        this._address = highloadAddress;
        this._keys = keys;
        this._subwalletId = subwalletId;
        this._contract = tonClient.provider(highloadAddress, {
            code: HIGHLOAD_CODE_V2,
            data: beginCell()
                .storeUint(subwalletId, 32)
                .storeUint(0, 64)
                .storeBuffer(keys.publicKey)
                .storeBit(0)
                .endCell()
        });
    }

    get address() {
        return this._address;
    }

    async sendMessages(messagesDictionary: Dictionary<number, Cell>): Promise<bigint> {
        const queryId = makeQueryId();
        const toSign = beginCell()
            .storeUint(this._subwalletId, 32)
            .storeUint(queryId, 64)
            .storeDict(messagesDictionary, Dictionary.Keys.Int(16), {
                serialize: (src, builder) => {
                    builder.storeUint(
                        1, // send_mode: 1 + 2 : PAY_GAS_SEPARATELY (ok) | IGNORE_ERRORS (?)
                        8
                    );
                    builder.storeRef(src);
                },
                parse: (src) => {
                    return beginCell()
                        .storeUint(src.loadUint(1), 8)
                        .storeRef(src.loadRef())
                        .endCell();
                }
            });

        const signature = sign(toSign.endCell().hash(), this._keys.secretKey);

        const body = beginCell()
            .storeBuffer(signature)     // store signature
            .storeBuilder(toSign)       // store our message
            .endCell();

        // send messages
        const res = await retry(
            async () => {
                await this._contract.external(body);
            }, {
                attempts: ATTEMPTS_NUMBER, attemptInterval: ATTEMPTS_INTERVAL, verbose: true,
                on_fail: () => console.warn('SEND MESSAGES FAILED, RETRYING')
            });

        if (!res.ok) {
            throw new Error('Send messages failed');
        }

        return queryId;
    }
}
