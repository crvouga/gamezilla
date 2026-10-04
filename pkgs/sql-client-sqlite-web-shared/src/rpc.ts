import type { RunResult } from '@pkgs/sql-client-root-shared/interface';
import type { Value } from '@pkgs/sql-root-shared/sql';

/**
 * Compile-time documentation marker: values at the RPC boundary must be
 * structured-clone safe (no functions / class instances / `Sql` objects).
 */
export type CloneSafe<T> = T;

export type SqlWire = {
  readonly sql: string;
  readonly values: readonly Value[];
};

export type SerializedError = {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
};

export const RPC_ERROR_LEADER_LOST = 'E_LEADER_LOST';
export const RPC_ERROR_TX_TIMEOUT = 'E_TX_TIMEOUT';
export const RPC_ERROR_TX_ABORTED = 'E_TX_ABORTED';
export const RPC_ERROR_NOT_CONNECTED = 'E_NOT_CONNECTED';
export const RPC_ERROR_TIMEOUT = 'E_TIMEOUT';

export const DEFAULT_RPC_TIMEOUT_MS = 30_000;
export const TX_IDLE_TIMEOUT_MS = 10_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_REAP_MS = 15_000;
export const OWNER_CLOSE_GRACE_MS = 5_000;

export type RpcOp =
  | 'connect'
  | 'disconnect'
  | 'heartbeat'
  | 'query'
  | 'run'
  | 'prepare'
  | 'stmtQuery'
  | 'stmtRun'
  | 'finalize'
  | 'beginTx'
  | 'txQuery'
  | 'txRun'
  | 'commitTx'
  | 'rollbackTx'
  | 'resetDatabase'
  | 'exportBytes'
  | 'importBytes'
  | 'becomeOwner'
  | 'releaseOwner';

export type ConnectResult = {
  readonly role: 'owner' | 'proxy';
};

export type DbChangedNotify = {
  readonly type: 'db-changed';
  readonly dbName: string;
  readonly txId?: string;
};

type OpPayloadMap = {
  connect: Record<string, never>;
  disconnect: Record<string, never>;
  heartbeat: Record<string, never>;
  query: SqlWire;
  run: SqlWire;
  prepare: SqlWire;
  stmtQuery: { readonly stmtId: string; readonly params: readonly Value[] };
  stmtRun: { readonly stmtId: string; readonly params: readonly Value[] };
  finalize: { readonly stmtId: string };
  beginTx: Record<string, never>;
  txQuery: { readonly txId: string; readonly sql: SqlWire };
  txRun: { readonly txId: string; readonly sql: SqlWire };
  commitTx: { readonly txId: string };
  rollbackTx: { readonly txId: string };
  resetDatabase: Record<string, never>;
  exportBytes: Record<string, never>;
  importBytes: { readonly bytes: Uint8Array };
  becomeOwner: Record<string, never>;
  releaseOwner: Record<string, never>;
};

type OpResultMap = {
  connect: ConnectResult;
  disconnect: null;
  heartbeat: null;
  query: readonly Record<string, unknown>[];
  run: RunResult;
  prepare: { readonly stmtId: string };
  stmtQuery: readonly Record<string, unknown>[];
  stmtRun: RunResult;
  finalize: null;
  beginTx: { readonly txId: string };
  txQuery: readonly Record<string, unknown>[];
  txRun: RunResult;
  commitTx: null;
  rollbackTx: null;
  resetDatabase: null;
  exportBytes: Uint8Array;
  importBytes: null;
  becomeOwner: null;
  releaseOwner: null;
};

export type RpcRequest<O extends RpcOp = RpcOp> = {
  readonly id: string;
  readonly dbName: string;
  readonly op: O;
  readonly payload: OpPayloadMap[O];
  /** Present on BroadcastChannel leader path for response routing. */
  readonly from?: string;
};

export type RpcResponse<O extends RpcOp = RpcOp> =
  | {
      readonly id: string;
      readonly ok: true;
      readonly result: OpResultMap[O];
    }
  | {
      readonly id: string;
      readonly ok: false;
      readonly error: SerializedError;
    };

export type BrokerToTabMessage = RpcRequest | RpcResponse | DbChangedNotify;

export function serializeSql(query: {
  readonly sql: string;
  readonly values: readonly Value[];
}): SqlWire {
  return {
    sql: query.sql,
    values: [...query.values],
  };
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string };
    return {
      name: error.name || 'Error',
      message: error.message,
      ...(error.stack !== undefined ? { stack: error.stack } : {}),
      ...(typeof withCode.code === 'string' ? { code: withCode.code } : {}),
    };
  }
  return {
    name: 'Error',
    message: String(error),
  };
}

export function rehydrateError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  if (serialized.stack !== undefined) {
    error.stack = serialized.stack;
  }
  if (serialized.code !== undefined) {
    (error as Error & { code?: string }).code = serialized.code;
  }
  return error;
}

export function isLeaderLostError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === RPC_ERROR_LEADER_LOST || error.name === 'LeaderLostError';
}

export function leaderLostError(message = 'Database owner lost'): Error {
  const error = new Error(message);
  error.name = 'LeaderLostError';
  (error as Error & { code?: string }).code = RPC_ERROR_LEADER_LOST;
  return error;
}

export function rpcTimeoutError(op: string): Error {
  const error = new Error(`RPC timed out for op "${op}"`);
  error.name = 'RpcTimeoutError';
  (error as Error & { code?: string }).code = RPC_ERROR_TIMEOUT;
  return error;
}

export type PendingRpc = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
  readonly timerId: unknown;
};

export function createRpcIdFactory(prefix = 'rpc'): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

export async function awaitRpcResponse<T>(args: {
  readonly id: string;
  readonly op: string;
  readonly pending: Map<string, PendingRpc>;
  readonly timers: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  };
  readonly timeoutMs?: number;
  readonly send: () => void;
}): Promise<T> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timerId = args.timers.setTimeout(() => {
      args.pending.delete(args.id);
      reject(rpcTimeoutError(args.op));
    }, timeoutMs);
    args.pending.set(args.id, {
      resolve: (value) => resolve(value as T),
      reject,
      timerId,
    });
    try {
      args.send();
    } catch (error: unknown) {
      args.timers.clearTimeout(timerId);
      args.pending.delete(args.id);
      reject(error);
    }
  });
}

export function settleRpcResponse(
  pending: Map<string, PendingRpc>,
  response: RpcResponse,
  timers: { clearTimeout: (id: unknown) => void }
): void {
  const entry = pending.get(response.id);
  if (entry === undefined) return;
  pending.delete(response.id);
  timers.clearTimeout(entry.timerId);
  if (response.ok) {
    entry.resolve(response.result);
  } else {
    entry.reject(rehydrateError(response.error));
  }
}
