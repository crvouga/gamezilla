import type { Timers } from '@pkgs/clock';
import type { Value } from '@pkgs/sql';
import type { RunResult, SqlClient } from '@pkgs/sql-client/interface';
import type { OwnerRuntime } from '../../src/owner-runtime';
import {
  createRpcIdFactory,
  type DbChangedNotify,
  RPC_ERROR_TX_ABORTED,
  type RpcRequest,
  type RpcResponse,
  type SqlWire,
  serializeError,
  TX_IDLE_TIMEOUT_MS,
} from '../../src/rpc';
import { execMemorySql } from './memory-sql';

type Row = Record<string, Value>;

class MemoryOwnerRuntime implements OwnerRuntime {
  readonly dbName: string;
  private readonly timers: Timers;
  private readonly tables = new Map<string, Row[]>();
  private readonly changeListeners = new Set<
    (notify: DbChangedNotify) => void
  >();
  private readonly nextTxId = createRpcIdFactory('mtx');
  private activeTxId: string | null = null;
  private idleTimer: unknown | null = null;
  private openFlag = false;

  constructor(args: { readonly dbName: string; readonly timers: Timers }) {
    this.dbName = args.dbName;
    this.timers = args.timers;
  }

  private exec(sqlText: string, values: Value[]): RunResult | Row[] {
    return execMemorySql(this.tables, sqlText, values);
  }

  private emit(txId?: string): void {
    const notify: DbChangedNotify = {
      type: 'db-changed',
      dbName: this.dbName,
      ...(txId !== undefined ? { txId } : {}),
    };
    for (const listener of this.changeListeners) listener(notify);
  }

  private touchIdle(): void {
    if (this.idleTimer !== null) this.timers.clearTimeout(this.idleTimer);
    if (this.activeTxId === null) return;
    this.idleTimer = this.timers.setTimeout(() => {
      this.activeTxId = null;
      this.idleTimer = null;
    }, TX_IDLE_TIMEOUT_MS);
  }

  private stubClient(): SqlClient {
    const exec = (sqlText: string, values: Value[]) =>
      this.exec(sqlText, values);
    const self = this;
    const tx: SqlClient = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      query: async (q) => exec(q.sql, [...q.values]) as Row[],
      run: async (q) => exec(q.sql, [...q.values]) as RunResult,
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
      transaction: async (fn) => fn(self.stubClient()),
    };
    return tx;
  }

  async open(): Promise<void> {
    this.openFlag = true;
  }

  async close(): Promise<void> {
    this.openFlag = false;
    this.activeTxId = null;
  }

  getClient(): SqlClient {
    if (!this.openFlag) throw new Error('closed');
    return this.stubClient();
  }

  async handleRequest(request: RpcRequest): Promise<RpcResponse> {
    try {
      return await this.dispatch(request);
    } catch (error: unknown) {
      return { id: request.id, ok: false, error: serializeError(error) };
    }
  }

  private async dispatch(request: RpcRequest): Promise<RpcResponse> {
    switch (request.op) {
      case 'query':
        return this.queryResponse(request);
      case 'run':
        return this.runResponse(request);
      case 'beginTx':
        return this.beginTxResponse(request);
      case 'txQuery':
      case 'txRun':
        return this.txSqlResponse(request);
      case 'commitTx':
        return this.commitTxResponse(request);
      case 'rollbackTx':
        return this.rollbackTxResponse(request);
      case 'resetDatabase':
        this.tables.clear();
        return { id: request.id, ok: true, result: null };
      default:
        return { id: request.id, ok: true, result: null };
    }
  }

  private queryResponse(request: RpcRequest): RpcResponse {
    const sql = request.payload as SqlWire;
    return {
      id: request.id,
      ok: true,
      result: this.exec(sql.sql, [...sql.values]) as Row[],
    };
  }

  private runResponse(request: RpcRequest): RpcResponse {
    const sql = request.payload as SqlWire;
    const result = this.exec(sql.sql, [...sql.values]) as RunResult;
    this.emit();
    return { id: request.id, ok: true, result };
  }

  private beginTxResponse(request: RpcRequest): RpcResponse {
    if (this.activeTxId !== null) {
      throw Object.assign(new Error('tx busy'), { code: RPC_ERROR_TX_ABORTED });
    }
    const txId = this.nextTxId();
    this.activeTxId = txId;
    this.touchIdle();
    return { id: request.id, ok: true, result: { txId } };
  }

  private txSqlResponse(request: RpcRequest): RpcResponse {
    const payload = request.payload as { txId: string; sql: SqlWire };
    if (this.activeTxId !== payload.txId) {
      throw Object.assign(new Error('bad tx'), { code: RPC_ERROR_TX_ABORTED });
    }
    this.touchIdle();
    const result = this.exec(payload.sql.sql, [...payload.sql.values]);
    return { id: request.id, ok: true, result: result as never };
  }

  private commitTxResponse(request: RpcRequest): RpcResponse {
    const payload = request.payload as { txId: string };
    if (this.activeTxId !== payload.txId) {
      throw Object.assign(new Error('bad tx'), { code: RPC_ERROR_TX_ABORTED });
    }
    this.activeTxId = null;
    if (this.idleTimer !== null) this.timers.clearTimeout(this.idleTimer);
    this.emit(payload.txId);
    return { id: request.id, ok: true, result: null };
  }

  private rollbackTxResponse(request: RpcRequest): RpcResponse {
    const payload = request.payload as { txId: string };
    if (this.activeTxId === payload.txId) {
      this.activeTxId = null;
      if (this.idleTimer !== null) this.timers.clearTimeout(this.idleTimer);
    }
    return { id: request.id, ok: true, result: null };
  }

  onChanged(listener: (notify: DbChangedNotify) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  async resetDatabase(): Promise<void> {
    this.tables.clear();
  }

  hasActiveTx(): boolean {
    return this.activeTxId !== null;
  }
}

/** Tiny in-memory store for Playwright multi-tab protocol tests (not SQLite). */
export function createMemoryOwnerRuntime(args: {
  readonly dbName: string;
  readonly timers: Timers;
}): OwnerRuntime {
  return new MemoryOwnerRuntime(args);
}
