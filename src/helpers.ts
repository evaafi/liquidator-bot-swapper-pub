import {isBannedSwapFrom, isBannedSwapTo, MIN_VALUE_SWAP_LIMIT} from "./config";
import {Cell, Dictionary} from "@ton/ton";
import {AssetInfo} from "./lib/assets_collection";

export function getFriendlyAmount(amount: bigint, scale: bigint, name: string) {
    let amt = Number(amount);
    amt /= Number(scale);
    return amt.toFixed(2) + " " + name;
}


export function formatSwapCanceledMessage(assetOffer: AssetInfo, assetAsk: AssetInfo, swapAmount: bigint) {
    return `Swap cancelled (${getFriendlyAmount(swapAmount, assetOffer.scale, assetOffer.symbol)} -> ${assetAsk.symbol})`
}

/**
 * @param assetFrom
 * @param assetAmount amount of assets in its wei
 * @param assetTo
 * @param prices prices dictionary
 */
export async function checkEligibleSwapTask(
    assetFrom: AssetInfo, assetAmount: bigint, assetTo: AssetInfo, prices?: Dictionary<bigint, bigint>
): Promise<boolean> {
    if (isBannedSwapFrom(assetFrom.id)) {
        console.error(`Cant swap ${assetFrom.symbol} asset!`);
        return false;
    }

    if (isBannedSwapTo(assetTo.id)) {
        console.error(`Cant swap to ${assetTo.symbol} asset!`);
        return false;
    }

    // check if we should ignore value threshold check
    if (!prices || prices!.keys().length === 0) {
        console.error(`Failed to obtain prices from middleware!`);
        return true;
    }

    if (!prices.has(assetFrom.id)) {
        console.error(`No price for asset ${assetFrom.symbol}`);
        return false;
    }

    const assetPrice = prices!.get(assetFrom.id)!;
    // console.log('ASSET PRICE: ', assetPrice);

    const assetFromScale = assetFrom.scale;
    // equal to normalized_price * PRICE_ACCURACY( == 10**9)
    const assetValue = assetAmount * assetPrice / assetFromScale;
    // console.log(`ASSET VALUE: ${assetValue}, THRESHOLD: ${MIN_WORTH_SWAP_LIMIT}`);

    return assetValue > MIN_VALUE_SWAP_LIMIT;
}

// TODO: get from sdk when it will have it
export function unpackPrices(pricesCell: Cell): Dictionary<bigint, bigint> | undefined {
    if (!pricesCell) return undefined;
    const slice = pricesCell.beginParse();
    let assetCell: Cell | null = slice.loadRef();
    const res = Dictionary.empty<bigint, bigint>();
    while (assetCell != Cell.EMPTY && assetCell !== null) {
        const slice = assetCell.beginParse();
        const assetId = slice.loadUintBig(256);
        const medianPrice = slice.loadCoins();
        res.set(assetId, medianPrice);
        assetCell = slice.loadMaybeRef();

    }
    return res;
}
