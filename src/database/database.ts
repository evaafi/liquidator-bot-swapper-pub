import {Database, open} from "sqlite";
import sqlite3 from 'sqlite3';
import {SwapTask} from "./types";
import {TransactionStatus} from "../swapper/helpers";

const SEVEN_DAYS: number = 60 * 60 * 24 * 7 * 1000;
const PERIOD_BEFORE_DELETE = SEVEN_DAYS;

function transformSwapTask(row: any): SwapTask {
    return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tokenOffer: BigInt(row.token_offer),
        tokenAsk: BigInt(row.token_ask),
        swapAmount: BigInt(row.swap_amount),
        routeID: row.route_id ?? 0,
        queryID: BigInt(row.query_id ?? 0),
        state: row.state,
        status: parseInt(row.status),
        pricesCell: row.prices_cell ?? '',
    };
}

export const SwapState = {
    Pending: 'pending',
    Sent: 'sent',
    Partial: 'partial',
    Success: 'success',
    Canceled: 'canceled',
    Failed: 'failed',
    Timeout: 'timeout',
}

export class MyDatabase {
    private readonly dbPath: string;
    private db: Database;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * Initializes swap_tasks table
     */
    async init() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.run(`
            CREATE TABLE IF NOT EXISTS swap_tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                token_offer VARCHAR NOT NULL,
                token_ask VARCHAR NOT NULL,
                swap_amount VARCHAR NOT NULL,
                query_id VARCHAR NOT NULL DEFAULT '0',
                route_id VARCHAR NOT NULL DEFAULT '0',
                state VARCHAR NOT NULL DEFAULT 'pending',
                status INTEGER NOT NULL DEFAULT 0,
                prices_cell VARCHAR NOT NULL DEFAULT ''
            )
        `); // no prices ('') means that value check will not be done
    }

    /**
     * Adds a swap task to database
     * @param createdAt task creation time
     * @param tokenOffer token to swap from
     * @param tokenAsk token to swap to
     * @param swapAmount amount of offered token
     * @param pricesCell cell with prices and oracles info form evaa.getPrices()
     */
    async addSwapTask(createdAt: number, tokenOffer: bigint, tokenAsk: bigint, swapAmount: bigint, pricesCell: string) {
        await this.db.run(`INSERT INTO swap_tasks 
            (created_at, updated_at, token_offer, token_ask, swap_amount, prices_cell) 
            VALUES(?, ?, ?, ?, ?, ?)`,
            createdAt, createdAt, tokenOffer.toString(), tokenAsk.toString(), swapAmount.toString(), pricesCell)
    }

    /**
     * Updates task state and status to inform that task was sent and should be tracked
     * @param id task id
     * @param queryID updated query id
     * @param routeID updated route id
     */
    async takeSwapTask(id: number, queryID: bigint, routeID: number) {
        console.log("ARGS: ", id, queryID, routeID);
        await this.db.run(`
            UPDATE swap_tasks 
            SET state = ?, status = ?, updated_at = ?, query_id = ?, route_id = ?
            WHERE id = ?
        `, SwapState.Sent, TransactionStatus.Pending, Date.now(), queryID.toString(), routeID, id)
    }

    /**
     * Updates task state and status to inform that task has succeeded
     * @param id task id
     * @param status task status
     */
    async succeedTask(id: number, status: number) {
        await this.db.run(`
            UPDATE swap_tasks 
            SET state = ?, status = ?, updated_at = ?
            WHERE id = ?
        `, SwapState.Success, status, Date.now(), id);
    }

    /**
     * Updates task to inform that timeout was reached
     * @param id task id
     * @param status task status
     */
    async timeoutTask(id: number, status: number) {
        await this.db.run(`
            UPDATE swap_tasks 
            SET state = ?, status = ?, updated_at = ?
            WHERE id = ?
        `, SwapState.Timeout, status, Date.now(), id);
    }

    /**
     * Updates task to inform that it failed
     * @param id task id
     * @param status task failure status (more details)
     */
    async failTask(id: number, status: number) {
        await this.db.run(`
            UPDATE swap_tasks 
            SET state = ?, status = ?, updated_at = ?
            WHERE id = ?
        `, SwapState.Failed, status, Date.now(), id);
    }

    /**
     * Cancels task
     * @param id task id
     */
    async cancelTask(id: number) {
        await this.db.run(`
            UPDATE swap_tasks 
            SET state = ?, status = ?, updated_at = ?
            WHERE id = ?
        `, SwapState.Canceled, TransactionStatus.InProcess, Date.now(), id);
    }

    /**
     * @returns tasks by state
     * @param state task state
     * @param num max number of tasks to return
     */
    async getSwapsByState(state: string, num: number = null): Promise<SwapTask[]> {
        let results: any;
        if (typeof num === 'number') {
            results = await this.db.all(`
                SELECT * FROM swap_tasks  
                WHERE state = ? LIMIT ?
            `, state, num);
        } else {
            results = await this.db.all(`SELECT * FROM swap_tasks WHERE state = ?`, state);
        }

        if (!results || !Array.isArray(results) || (results.length === 0)) {
            return [];
        }

        return results.map(transformSwapTask);
    }

    /**
     * @returns pending tasks
     * @param num max number of tasks to return
     */
    async getPendingSwaps(num: number = null) {
        return await this.getSwapsByState(SwapState.Pending, num);
    }

    /**
     * @returns sent tasks
     * @param num max number of tasks to return
     */
    async getSentSwaps(num: number = null) {
        return await this.getSwapsByState(SwapState.Sent, num);
    }

    /**
     * @returns processed tasks
     * @param num max number of tasks to return
     */
    async getProcessedSwaps(num: number = null) {
        let results: any;
        if (typeof num === 'number') {
            results = await this.db.all(
                `SELECT * FROM swap_tasks WHERE state NOT IN ('pending', 'success') LIMIT ?`
                , num);
        } else {
            results = await this.db.all(
                `SELECT * FROM swap_tasks WHERE state NOT IN ('pending', 'sent')`
            );
        }

        if (!results || !Array.isArray(results) || (results.length === 0)) {
            return [];
        }

        return results.map(transformSwapTask);
    }

    /**
     * @returns list of distinct tasks states, for debugging purposes
     */
    async getSwapStates() {
        const result = await this.db.all(`SELECT DISTINCT state FROM swap_tasks`);
        if (!result) return [];

        const states: string[] = [];
        for (const row of result) {
            states.push(row.state);
        }

        return states;
    }

    async updateTaskStatus(id: number, status: number) {
        if (status !== 1) {
            await this.db.run(`
            UPDATE swap_tasks
            SET status = ?, updated_at = ?
            WHERE id = ?
            `, status, Date.now(), id)
        } else {
            await this.db.run(`
            UPDATE swap_tasks
            SET state = 'succeeded', status = 1, updated_at = ?
            WHERE id = ?
            `, Date.now(), id)
        }
    }

    // How can we process it?
    async processFailedTasks() {
        throw new Error('Not implemented yet');
    }

    // // Do we need it at all?
    // async cancelOldSwaps() {
    //     await this.db.run(`
    //         UPDATE swap_tasks
    //         SET state = ?, updated_at = ?
    //         WHERE state = ? AND ? - created_at > 45000
    //     `, SwapState.Canceled, Date.now(), SwapState.Pending, Date.now())
    // }

    async deleteOldSwaps() {
        await this.db.run(`
            DELETE FROM swap_tasks WHERE ? - created_at >= ?
        `, Date.now(), PERIOD_BEFORE_DELETE)
    }
}
