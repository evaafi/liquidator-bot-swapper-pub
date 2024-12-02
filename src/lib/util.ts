import {Address, Dictionary, TonClient} from "@ton/ton";
import crypto from "crypto";
import {Decimal} from "decimal.js";
import {SwapTask} from "../database/types";
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

export function printBalances<V>(balances: Dictionary<bigint, V>, assetsCollection: AssetsCollection, prices?: Dictionary<bigint, bigint>) {
    let sum = 0;
    const ASSET_PRICE_SCALE = 10 ** 9;

    balances.keys().forEach((assetId) => {
        const asset = assetsCollection.byAssetId(assetId);
        const assetBalance = balances.get(assetId);
        let value: string | number = '';
        if (prices) {
            const price: bigint = prices.get(assetId) ?? 0n;
            value = Number(assetBalance) * Number(price) / ASSET_PRICE_SCALE;
            sum += value;
        }
        console.log(asset.symbol, assetBalance, value);
    });
    if (prices) {
        console.log('Total value: ', sum);
    }
}

export function printPrices(prices: Dictionary<bigint, bigint>) {
    prices.keys().forEach((assetId) => {
        const price = prices.get(assetId);
        console.log(Number(price) / 10 ** 9);
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
    swapId: string, swapAmount: number, tokenOffer: string, tokenAsk: string, state: string
}

export function makeSwapDescription(params: SwapDescriptionParams): string {
    return `Swap ${params.swapId}: ${params.swapAmount}  ${params.tokenOffer} --> ${params.tokenAsk} : state: ${params.state}`;
}

export function makeTaskDescription(params: SwapTask, assetsCollection: AssetsCollection): string {
    const {tokenOffer, tokenAsk, swapAmount} = params;
    const [assetOffer, assetAsk] = [tokenOffer, tokenAsk].map(id => assetsCollection.byAssetId(id));
    // if (!assetOffer) throw (`Unknown assetID ${tokenOffer}`);
    // if (!assetAsk) throw (`Unknown assetID ${tokenAsk}`);

    return makeSwapDescription({
        swapId: params.id.toString(),
        tokenOffer: assetOffer ? assetOffer.symbol : tokenOffer.toString(),
        tokenAsk: assetAsk ? assetAsk.symbol : tokenAsk.toString(),
        swapAmount: assetOffer ? assetOffer.fromWei(swapAmount) : Number(swapAmount),
        state: params.state
    })
}

type AddressState = "active" | "uninitialized" | "frozen";

export async function checkAddressState(tonClient: TonClient, address: Address): Promise<AddressState> {
    const accountState = await tonClient.getContractState(address);
    return accountState.state;
}
