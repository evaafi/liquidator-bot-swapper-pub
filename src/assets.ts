import {checkDefined, sha256Hash} from "./util";
import {Address} from "@ton/ton";
import {AssetInfo, AssetsCollection} from "./assets_collection";

export const JETTON_MASTERS_MAINNET = {
    ton: 'native',
    usdt: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    jusdt: 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
    jusdc: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3728',
    tston: 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav',
    stton: 'EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k',
    tonusdt_dedust: 'EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r',
    tonusdt_stonfi: 'EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE',
    ton_storm: 'EQCNY2AQ3ZDYwJAqx_nzl9i9Xhd_Ex7izKJM6JTxXRnO6n1F',
    usdt_storm: 'EQCup4xxCulCcNwmOocM9HtDYPU8xe0449tQLp6a-5BLEegW',
}

export const ASSET_ID = {
    ton: sha256Hash('TON'),
    jusdt: sha256Hash('jUSDT'),
    jusdc: sha256Hash('jUSDC'),
    stton: sha256Hash('stTON'),
    tston: sha256Hash('tsTON'),
    usdt: sha256Hash('USDT'),
    tonusdt_dedust: sha256Hash('TONUSDT_DEDUST'),
    tonusdt_stonfi: sha256Hash('TONUSDT_STONFI'),
    ton_storm: sha256Hash('TON_STORM'),
    usdt_storm: sha256Hash('USDT_STORM'),
};

export const JETTON_DECIMALS = {
    ton: 1_000_000_000n,            // 9
    usdt: 1_000_000n,               // 6
    jusdt: 1_000_000n,              // 6
    jusdc: 1_000_000n,              // 6
    tston: 1_000_000_000n,          // 9
    stton: 1_000_000_000n,          // 9
    tonusdt_dedust: 1_000_000_000n, // 9
    tonusdt_stonfi: 1_000_000_000n, // 9
    ton_storm: 1_000_000_000n,      // 9
    usdt_storm: 1_000_000_000n,     // 9
};

const NULL_ADDRESS = Address.parse('0:0000000000000000000000000000000000000000000000000000000000000000');

function makeAssetInfo(assetSymbol: string): AssetInfo {
    const decimals: bigint = JETTON_DECIMALS[assetSymbol];
    const id: bigint = ASSET_ID[assetSymbol];
    const address: string = JETTON_MASTERS_MAINNET[assetSymbol];
    const isNative = assetSymbol === 'ton';

    checkDefined(assetSymbol, "Asset symbol is not defined");
    checkDefined(decimals, "The 'decimals' parameter is not defined");
    checkDefined(id, "The 'id' parameter is not defined");
    checkDefined(address, "The 'address' parameter is not defined");

    return new AssetInfo({
        symbol: assetSymbol, decimals, id, address: (isNative ? 'native' : Address.parse(address)), isNative
    });
}


const ASSETS = {
    ton: makeAssetInfo('ton'),
    jusdt: makeAssetInfo('jusdt'),
    jusdc: makeAssetInfo('jusdc'),
    stton: makeAssetInfo('stton'),
    tston: makeAssetInfo('tston'),
    usdt: makeAssetInfo('usdt'),
}

const EXTENDED_ASSETS = {
    ton: makeAssetInfo('ton'),
    jusdt: makeAssetInfo('jusdt'),
    jusdc: makeAssetInfo('jusdc'),
    stton: makeAssetInfo('stton'),
    tston: makeAssetInfo('tston'),
    usdt: makeAssetInfo('usdt'),
    tonusdt_dedust: makeAssetInfo('tonusdt_dedust'),
    tonusdt_stonfi: makeAssetInfo('tonusdt_stonfi'),
    ton_storm: makeAssetInfo('ton_storm'),
    usdt_storm: makeAssetInfo('usdt_storm'),
}

export const ASSETS_COLLECTION_MAINNET = new AssetsCollection(ASSETS);
export const EXTENDED_ASSETS_COLLECTION_MAINNET = new AssetsCollection(EXTENDED_ASSETS);
