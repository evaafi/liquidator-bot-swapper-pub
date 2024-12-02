import {beginCell, Cell, Dictionary, internal, storeMessageRelaxed} from "@ton/ton";
import {Address} from "@ton/core";
import {
    ApiRoutingStep,
    ApiTokenAddress,
    ApiTransactionResult,
    ApiTransactionStatus,
    RoutingApi,
    waitForTransactionResults
} from "@swap-coffee/sdk";
import {checkDefined, notDefined} from "../lib/util";

import {FetchSwapMessagesResult, HighloadExchangeResult, ParsedSwapResult, SwapMessage, SwapParams} from "./types";
import {TransactionStatus} from './helpers';
import {HighloadWalletV2} from "../lib/highload_contract_v2";
import {retry} from "../lib/retry";
import {logMessage} from "../lib/messenger";

// TODO: refactor swapper, make centralized RoutingApi creation, use api key

function transformMessage(tx: any) {
    const {address, value, cell, send_mode, query_id} = tx;
    return {
        address: Address.parse(address),
        value: parseInt(value),
        cell: Cell.fromBase64(cell),
        send_mode: parseInt(send_mode),
        query_id: parseInt(query_id)
    };
}

function composeInternalMessage(msg: SwapMessage): Cell {
    return beginCell().store(
        storeMessageRelaxed(
            internal({
                to: msg.address,
                value: BigInt(msg.value),
                body: msg.cell,
            })
        )
    ).endCell();
}

function tokenInfo(token: string): ApiTokenAddress {
    return {blockchain: "ton", address: token};
}

/**
 * Retrieves swap messages from swap coffee endpoint
 * @param tokenOffer token to sell
 * @param tokenAsk token to get
 * @param amount amount of token to swap
 * @param maxSlippage max slippage coefficient
 * @param walletAddress wallet address
 * @param maxLength max number of jettons in the exchange route
 * @param referralName referral name for bonuses and rewards
 * @returns array of messages
 */
export async function fetchSwapMessages(
    walletAddress: string, // target wallet address (highload)
    tokenOffer: string, tokenAsk: string,
    amount: number,
    maxSlippage: number,
    maxLength: number,
    referralName?: string
): Promise<FetchSwapMessagesResult> {
    const routingApi = new RoutingApi();

    if (maxSlippage <= 0 || maxSlippage >= 1) {
        throw new Error(`Slippage value must be in (0, 1), provided value ${maxSlippage} is not valid`);
    }

    if (maxLength < 2 || maxLength > 5) {
        throw new Error(`Max length value must be in [2, 5], provided value ${maxLength} is not valid`);
    }

    logMessage("FETCH MESSAGES: BUILD ROUTE");

    const route = await routingApi.buildRoute({
        input_token: tokenInfo(tokenOffer),
        output_token: tokenInfo(tokenAsk),
        input_amount: amount,
        max_length: maxLength,
    });

    logMessage("FETCH MESSAGES: BUILD TRANSACTIONS");

    const steps: ApiRoutingStep[] = route?.data?.paths;
    checkDefined(steps, "Swap API returned no path")

    const transactions = await routingApi.buildTransactionsV2({
        sender_address: walletAddress,
        slippage: maxSlippage,
        paths: steps,
        referral_name: referralName,
    });

    const targetTransactions = transactions?.data?.transactions;
    checkDefined(targetTransactions, "No messages fetched, probably server error");

    const route_id: number = transactions?.data?.route_id;
    checkDefined(route_id, "No route_id fetched, probably server error");

    logMessage("TRANSFORM MESSAGES");
    const messages: SwapMessage[] = targetTransactions.map(transformMessage);

    return {messages, route_id};
}

/**
 * Carries out swap of currencies through a highload wallet
 * @param highloadWallet highload wallet contract
 * @param params swap parameters
 */
export async function highloadExchange(
    highloadWallet: HighloadWalletV2,
    params: SwapParams
): Promise<HighloadExchangeResult> {
    // console.log(`highloadExchange SwapParams:`, params);
    const {
        tokenOffer, tokenAsk, swapAmount,
        maxSlippage, maxLength,
        referralName
    } = params;

    let fetchResult = await fetchSwapMessages(
        highloadWallet.address.toString(),
        tokenOffer, tokenAsk, swapAmount,
        maxSlippage, maxLength,
        referralName
    );

    // console.debug("FETCHED MESSAGES: ", fetchResult.messages);

    const dictionary = fetchResult.messages
        .map(composeInternalMessage)
        .reduce(
            (prev, curr, index) => prev.set(index, curr),
            Dictionary.empty<number, Cell>()
        );

    const queryId = await highloadWallet.sendMessages(dictionary);

    return {route_id: fetchResult.route_id, query_id: queryId};
}

function transformStatus(status: ApiTransactionStatus): number {
    switch (status) {
        case ApiTransactionStatus.Pending:
            return TransactionStatus.Pending;
        case ApiTransactionStatus.PartiallyComplete:
            return TransactionStatus.PartiallyComplete;
        case ApiTransactionStatus.Succeeded:
            return TransactionStatus.Succeeded;
        case ApiTransactionStatus.TimedOut:
            return TransactionStatus.TimedOut;
        case ApiTransactionStatus.Failed:
            return TransactionStatus.Failed;
        default:
            break;
    }
    return TransactionStatus.Unknown;
}

function combineStatuses(results: any[]): number {
    return results.reduce(
        (prev: number, curr: any) => prev | transformStatus(curr.status)
        , 0
    );
}

/**
 * Checks swap result, to be used in a tx monitor
 * @param routeId swap route id
 * @returns combined status of multi-message transaction
 */
export async function checkSwapResult(routeId: number): Promise<number> {
    const routingApi = new RoutingApi();

    const res = await retry(
        async () => await routingApi.getTransactionsResult(routeId),
        {attempts: 3, attepmtInterval: 500, verbose: true}
    );

    if (!res.ok) {
        logMessage(`Either no data on route or service is off`);
        return TransactionStatus.TimedOut;
    }

    let data: ApiTransactionResult[] = res.value?.data;
    if (notDefined(data)) { // null or undefined
        return TransactionStatus.TimedOut;
    }

    return data.reduce(
        (prev: number, curr: ApiTransactionResult): number => prev | transformStatus(curr.status)
        , 0);
}

export async function waitSwapResult(routeId: number): Promise<number> {
    const routingApi = new RoutingApi();
    const res = await retry(
        async () => await waitForTransactionResults(routeId, routingApi, 3_000),
        {attempts: 3, attemptInterval: 1000}
    );

    if (!res.ok || notDefined(res.value) || !Array.isArray(res.value)) {
        return TransactionStatus.New;
    }

    return combineStatuses(res.value);
}

export function parseSwapResult(swapResult: number): ParsedSwapResult {
    let res: ParsedSwapResult = {
        pending: false,
        partially_complete: false,
        succeeded: false,
        timed_out: false,
        failed: false
    };

    if ((swapResult & TransactionStatus.Pending) !== 0) {
        res.pending = true;
    }
    if ((swapResult & TransactionStatus.PartiallyComplete) !== 0) {
        res.partially_complete = true;
    }
    if ((swapResult & TransactionStatus.Succeeded) !== 0) {
        res.succeeded = true;
    }
    if ((swapResult & TransactionStatus.TimedOut) !== 0) {
        res.timed_out = true;
    }
    if ((swapResult & TransactionStatus.Failed) !== 0) {
        res.failed = true;
    }

    return res;
}
