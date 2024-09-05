import {Address, Dictionary, TonClient} from "@ton/ton";
import crypto from "crypto";
import {Decimal} from "decimal.js";
import {SwapTask} from "./database/types";
import {AssetsCollection} from "./assets_collection";

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function bufferToBigInt(x: Buffer) {
    return BigInt('0x' + x.toString('hex'))
}

export function _checkedLoadArgument(argName: string) {
    if ((typeof argName) === 'undefined') {
        throw new Error('Undefined argument');
    }

    const argValue = process.env[argName];
    if (typeof argValue === 'undefined') {
        throw new Error(`${argName} value is not defined`);
    }

    // console.log(`Loaded value: ${argName}=${argValue}`);

    return argValue;
}

export function loadAddress(argName: string): string {
    const value = _checkedLoadArgument(argName);
    const address = Address.parse(value);
    if (!Address.isAddress(address)) {
        throw new Error(`${argName} is not a valid address`);
    }

    return value;
}

export function loadString(argName: string): string {
    return _checkedLoadArgument(argName);
}

export function makeQueryId(): bigint {
    const queryID = crypto.randomBytes(4).readUint32BE();
    const now = Math.floor(Date.now() / 1000);
    const timeout = 60;
    const finalQueryID = (BigInt(now + timeout) << 32n) + BigInt(queryID);

    return finalQueryID;
}

export function printBalances<V>(balances: Dictionary<bigint, V>, assetsCollection: AssetsCollection) {
    balances.keys().forEach((assetId) => {
        const asset = assetsCollection.byAssetId(assetId);
        const assetBalance = balances.get(assetId);
        console.log(asset.symbol, assetBalance);
    })
}

export function printProperties(obj: Object, prependMsg: string = '') {
    for (const prop in obj) {
        console.log(`${prependMsg}${prop}: \t${obj[prop]}`);
    }
}

export function formatProperties(obj: Object, prependMsg: string = ''): string {
    let res: string = '';
    for (const prop in obj) {
        res = res.concat('\n', `${prependMsg}${prop}: \t${obj[prop]}`);
    }

    return res;
}

export type AsyncLambda<T> = () => Promise<T>;

export type DummyFunction = () => {};
const DUMMY_FUNCTION_INSTANCE = () => {
};

type RetryParams = {
    attempts: number,
    attemptInterval: number,
    verbose: boolean,
    on_fail: DummyFunction,
}

const DEFAULT_RETRY_PARAMS = {
    attempts: 3,
    attemptInterval: 3000,
    verbose: true,
    on_fail: DUMMY_FUNCTION_INSTANCE,
};

/**
 * Tries to run specified lambda several times if it throws
 * @type T type of the return value
 * @param lambda lambda function to run
 * @param params retry function params: attempts - for number of attempts, attemptInterval - number of ms to wait between retries, ...
 * @returns
 */
export async function retry<T>(lambda: AsyncLambda<T>, params: any = {}) {
    let value = null;
    let ok = false;
    const {attempts, attemptInterval, verbose, on_fail}: RetryParams = {...DEFAULT_RETRY_PARAMS, ...params};
    let n = attempts;

    while (n > 0 && !ok) {
        try {
            value = await lambda();
            ok = true;
        } catch (e) {
            if (typeof on_fail === 'function') {
                on_fail();
            }
            if (verbose) {
                console.log(e);
            }
            console.log(`Call failed, retrying. Retries left: ${--n}`);
            await sleep(attemptInterval);
        }
    }

    return {ok, value};
}

export const _str = (v: any): string => v.toString();
export const _decimal = (v: any): Decimal => new Decimal(_str(v ?? 0));
export const _bigint = (v: any): BigInt => BigInt(v ?? 0);

export function sha256Hash(input: string): bigint {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    const hashBuffer = hash.digest();
    const hashHex = hashBuffer.toString('hex');
    return BigInt('0x' + hashHex);
}

export function isDefined(v: any): boolean {
    return (typeof v !== 'undefined' || v !== null);
}

export function notDefined(v: any): boolean {
    return typeof v === 'undefined' || v === null;
}

export function checkDefined(v: any, message: string) {
    if (notDefined(v)) {
        throw new Error(message);
    }
}

type SwapDescriptionParams = {
    swapAmount: number, tokenOffer: string, tokenAsk: string, state: string
}

export function makeSwapDescription(params: SwapDescriptionParams): string {
    return `${params.swapAmount}  ${params.tokenOffer} --> ${params.tokenAsk} : state: ${params.state}`;
}

export function makeTaskDescription(params: SwapTask, assetsCollection: AssetsCollection): string {
    const {tokenOffer, tokenAsk, swapAmount} = params;
    const [assetOffer, assetAsk] = [tokenOffer, tokenAsk].map(id => assetsCollection.byAssetId(id));
    if (!assetOffer) throw (`Unknown assetID ${tokenOffer}`);
    if (!assetAsk) throw (`Unknown assetID ${tokenAsk}`);

    return makeSwapDescription({
        tokenOffer: assetOffer.symbol,
        tokenAsk: assetAsk.symbol,
        swapAmount: assetOffer.fromWei(swapAmount),
        state: params.state
    })
}

type AddressState = "active" | "uninitialized" | "frozen";

export async function checkAddressState(tonClient: TonClient, address: Address): Promise<AddressState> {
    const accountState = await tonClient.getContractState(address);
    return accountState.state;
}
