import {ASSET_ID} from "./assets";
import {SwapLimits} from "./types";

// non-native assets list
export const EXTENDED_ASSET_LIST = [
    'ton', 'jusdc', 'jusdt', 'stton', 'tston', 'usdt',
    'tonusdt_dedust', 'tonusdt_stonfi', 'ton_storm', 'usdt_storm'
];

export const MAX_SLIPPAGE = {
    PP_10: 0.1,
    PP_05: 0.05,
    PP_03: 0.03,
    PP_02: 0.02,
    PP_01: 0.01,
}

// assets banned from being swapped from
export const BANNED_ASSETS_FROM = [
    // ASSET_ID.tsTON,
    ASSET_ID.jusdc
];
// assets banned from being swapped to
export const BANNED_ASSETS_TO = [
    // ASSET_ID.tsTON,
    ASSET_ID.jusdc
];

/**
 * selects swap limits based on swap tokens
 * this function is config-like, so I placed it to the config.ts
 * @param offerAssetId id of the token to exchange
 * @param askAssetId id of the token to receive
 */
export function getSwapLimits(offerAssetId: bigint, askAssetId: bigint): SwapLimits {
    const tonId = ASSET_ID.ton;
    const includesTon = offerAssetId === tonId || askAssetId === tonId;
    return {
        max_swap_length: includesTon ? 2 : 3,
        max_slippage: includesTon ? MAX_SLIPPAGE.PP_03 : MAX_SLIPPAGE.PP_05,
    }
}

export function isBannedSwapFrom(assetID: bigint): boolean {
    return BANNED_ASSETS_FROM.findIndex(value => value === assetID) >= 0;
}

export function isBannedSwapTo(assetID: bigint): boolean {
    return BANNED_ASSETS_TO.findIndex(value => value === assetID) >= 0;
}

export const SUPPORTED_ASSET_IDS = [
    ASSET_ID.ton,
    ASSET_ID.jusdc,
    ASSET_ID.jusdt,
    ASSET_ID.stton,
    ASSET_ID.tston,
    ASSET_ID.usdt,
    // ASSET_ID.tonusdt_dedust,
    // ASSET_ID.tonusdt_stonfi,
    // ASSET_ID.ton_storm,
    // ASSET_ID.usdt_storm,

]; // only standard tokens are supported for now

const PRICE_ACCURACY = 1_000_000_000n;
export const MIN_VALUE_SWAP_LIMIT: bigint = 100n * PRICE_ACCURACY; //  == 100$