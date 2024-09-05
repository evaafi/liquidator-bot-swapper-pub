import {Address, Cell} from "@ton/core";

export type SwapMessage = {
    address: Address,
    value: number,
    cell: Cell,
    send_mode: number,
    query_id: number,
}

export type FetchSwapMessagesResult = {
    messages: SwapMessage[],
    route_id: number,
}

export type HighloadExchangeResult = {
    route_id: number,
    query_id: bigint,
}

export type SwapParams = {
    tokenOffer: string,     // jetton to sell 
    tokenAsk: string,       // jetton to buy
    swapAmount: number,     // amount of tokens without decimals e.g. 1.2345 
    maxSlippage: number,    // maximum slippage coefficient, e.g. 0.03 stands for 3%
    maxLength: number,      // maximum number of path points, mubst be in [2, 5]  ( >= 2 and <= 5 )
}

export type ParsedSwapResult = {
    pending: boolean,
    partially_complete: boolean,
    succeeded: boolean,
    timed_out: boolean,
    failed: boolean,
};
