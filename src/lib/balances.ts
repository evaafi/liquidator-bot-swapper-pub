import {Address, Dictionary, TonClient, TupleBuilder} from "@ton/ton";
import {checkAddressState, isDefined} from "./util";
import {ASSET_ID} from "../assets";
import {AssetsCollection} from "./assets_collection";
import {retry} from "./retry";

export type WalletBalances = Dictionary<bigint, bigint>;
export type NormalizedWalletBalances = Dictionary<bigint, number>;

export function initEmptyBalances(): WalletBalances {
    return Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64));
}

export function initNormalizedBalances(): NormalizedWalletBalances {
    return Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Uint(64));
}

export function normalizeBalances(balances: WalletBalances, assetsCollection: AssetsCollection): NormalizedWalletBalances {
    const normalized = initNormalizedBalances();

    balances.keys().forEach(id => {
        const assetBalance = parseFloat(balances.get(id).toString());
        const assetDecimals = parseFloat(assetsCollection.byAssetId(id).scale.toString());
        normalized.set(id, assetBalance / assetDecimals);
    });

    return normalized;
}

export async function getUserWallet(tonClient: TonClient, masterWallet: Address | string, userAddress: Address): Promise<Address | string> {
    if (typeof masterWallet === 'string') {
        if (masterWallet as string === 'native')
            return 'native';
        throw (`Invalid argument masterWallet`);
    }

    const builder = new TupleBuilder();
    builder.writeAddress(userAddress);
    const params = builder.build();
    const data = await tonClient.runMethod(masterWallet as Address, 'get_wallet_address', params);

    return data.stack.readAddress();
}

export async function getUserWallets(
    tonClient: TonClient,
    walletAddress: Address,
    assetsCollection: AssetsCollection): Promise<Map<bigint, Address>> {

    const ids = assetsCollection.ids().filter(id => id !== ASSET_ID.ton);
    const walletsResult = await retry(
        async () => await Promise.all(
            ids.map(assetId => getUserWallet(tonClient, assetsCollection.byAssetId(assetId).address, walletAddress))
        ), {
            attempts: 3, attemptInterval: 1000,
            on_fail: () => console.log("getUserWallet failed, retrying...")
        }
    );

    if (!walletsResult.ok) {
        throw new Error("Failed to get user wallets");
    }

    const wallets = new Map<bigint, Address>();
    walletsResult.value.forEach((address: Address, index: number) => {
        wallets.set(ids[index], address);
    });

    return wallets;
}

export async function getBalances(
    tonClient: TonClient,
    walletAddress: Address,
    assetsCollection: AssetsCollection,
    jettonWallets: Map<bigint, Address> = null
): Promise<WalletBalances> {
    let _jettonWallets = jettonWallets;
    if (jettonWallets === null) {
        _jettonWallets = await getUserWallets(tonClient, walletAddress, assetsCollection);
    }

    const balancesResult = await retry<WalletBalances>(async (): Promise<WalletBalances> => {
        const balance: WalletBalances = initEmptyBalances();
        const tonBalance = await tonClient.getBalance(walletAddress);
        balance.set(ASSET_ID.ton, tonBalance);

        const ids = assetsCollection.ids().filter(id => id !== ASSET_ID.ton);
        const res = await Promise.all(
            ids.map(async (assetId): Promise<bigint> => {
                const jwAddress = _jettonWallets.get(assetId);
                if (!isDefined(jwAddress)) throw new Error(`Asset ${assetId} is not supported`);

                const accountState = await checkAddressState(tonClient, jwAddress);
                if (accountState !== 'active') {
                    // console.log(`${assetId}: JETTON WALLET ${jwAddress} is ${accountState}`);
                    return 0n;
                }

                const _res = await tonClient.runMethod(jwAddress, 'get_wallet_data');
                return _res.stack.readBigNumber();
            })
        );

        res.forEach((amount, index) => {
            balance.set(ids[index], amount);
        })

        return balance;
    }, {attempts: 5, attemptInterval: 500});

    if (!balancesResult.ok) {
        throw new Error("Failed to get balances");
    }

    return balancesResult.value;
}
