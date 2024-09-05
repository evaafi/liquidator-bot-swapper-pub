import {TupleReader} from "@ton/core";

export type SwapTask = {
    id: number;
    createdAt: number;
    updatedAt: number;
    tokenOffer: bigint;
    tokenAsk: bigint;
    swapAmount: bigint;
    routeID: number,
    queryID: bigint;
    state: string;
    status: number;
}

export type GetResult = {
    gas_used: number;
    stack: TupleReader;
    exit_code: number;
};

export type UserPrincipals = {
    ton: bigint,
    jusdt: bigint,
    jusdc: bigint,
    stton: bigint,
    tston: bigint,
    usdt: bigint
}