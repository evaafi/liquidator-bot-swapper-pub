import {Cell} from "@ton/core";
import {ASSET_ID} from "./assets";
import {SwapLimits} from "./types";

export const SUBWALLET_ID = 698983191;
export const HIGHLOAD_CODE_V2 = Cell.fromBase64('te6ccgEBCQEA5QABFP8A9KQT9LzyyAsBAgEgAgMCAUgEBQHq8oMI1xgg0x/TP/gjqh9TILnyY+1E0NMf0z/T//QE0VNggED0Dm+hMfJgUXO68qIH+QFUEIf5EPKjAvQE0fgAf44WIYAQ9HhvpSCYAtMH1DAB+wCRMuIBs+ZbgyWhyEA0gED0Q4rmMQHIyx8Tyz/L//QAye1UCAAE0DACASAGBwAXvZznaiaGmvmOuF/8AEG+X5dqJoaY+Y6Z/p/5j6AmipEEAgegc30JjJLb/JXdHxQANCCAQPSWb6VsEiCUMFMDud4gkzM2AZJsIeKz');
export const SERVICE_CHAT_ID = 0; // TODO: specify chat id

// non-native assets list
export const ASSET_LIST = ['ton', 'jusdc', 'jusdt', 'stton', 'tston', 'usdt'];

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

export const SUPPORTED_ASSETS =  [
    'ton',
    // 'jusdc', // banned
    'jusdt',
    'stton',
    // 'tston', // banned
    'usdt'
]; // only standard tokens are supported for now