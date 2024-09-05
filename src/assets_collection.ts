import {Address} from "@ton/ton";
import {Decimal} from "decimal.js";
import {_bigint, _decimal, _str} from "./util";

export type AssetInfoType = {
    symbol: string;
    decimals: bigint;
    id: bigint;
    isNative: boolean;
    address: Address | string;
}

export class AssetInfo {
    private readonly _symbol: string;
    private readonly _decimals: bigint;
    private readonly _id: bigint;
    private readonly _isNative: boolean;
    private readonly _address: Address | string;

    get isNative(): boolean {
        return this._isNative;
    }

    get address(): Address | string {
        return this._address;
    }

    get symbol(): string {
        return this._symbol;
    }

    get decimals(): bigint {
        return this._decimals;
    }

    get id(): bigint {
        return this._id;
    }

    fromWei(amount: bigint): number {
        return (new Decimal(_str(amount)).dividedBy(new Decimal(_str(this._decimals)))).toNumber();
    }

    toWei(amount: number | string): bigint {
        return _bigint(_decimal(amount).mul(_decimal(this.decimals)).toString()).valueOf();
    }

    constructor(info: AssetInfoType) {
        this._symbol = info.symbol;
        this._decimals = info.decimals;
        this._id = info.id;
        this._address = info.address;
        this._isNative = info.isNative;
    }
}

export class AssetsCollection {
    private readonly _assetsByName = new Map<string, AssetInfo>();
    private readonly _assetsById = new Map<bigint, AssetInfo>();

    constructor(assets: Object) {
        for (const [n, v] of Object.entries(assets)) {
            this._assetsByName.set(n, v);
            this._assetsById.set(v.id, v);
        }
    }

    addAsset(assetName: string, asset: AssetInfo) {
        this._assetsByName.set(assetName, asset);
        this._assetsById.set(asset.id, asset);
    }

    names(): string[] {
        return Array.from(this._assetsByName.keys());
    }

    ids(): bigint[] {
        return Array.from(this._assetsById.keys());
    }

    byAssetName(assetName: string): AssetInfo {
        return this._assetsByName.get(assetName.toLowerCase());
    }

    byAssetId(assetId: bigint): AssetInfo {
        return this._assetsById.get(assetId);
    }
}
