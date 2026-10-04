import type { Timers } from '@pkgs/clock-shared/types';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import type { Value } from '@pkgs/sql-shared/sql';
import type { RpcRequest, RpcResponse, SqlWire } from './rpc';
import { RPC_ERROR_TX_ABORTED, serializeError } from './rpc';
import { sqlFromWire } from './sql-wire';

export type ActiveTx = {
  readonly txId: string;
  readonly client: SqlClient;
  idleTimerId: unknown | null;
  resolveGate: () => void;
  rejectGate: (error: unknown) => void;
};

export type OwnerHandlerDeps = {
  readonly timers: Timers;
  readonly runExclusive: <T>(fn: () => Promise<T>) => Promise<T>;
  readonly ensureOpen: () => Promise<
    SqlClient & { prepare: SqlClient['prepare'] }
  >;
  readonly emitChanged: (txId?: string) => void;
  readonly stmts: Map<string, PreparedStatement<Record<string, unknown>>>;
  readonly nextStmtId: () => string;
  readonly nextTxId: () => string;
  readonly touchTxIdle: (tx: ActiveTx) => void;
  readonly createBypassClient: (owner: SqlClient) => SqlClient;
  readonly resetDatabase: () => Promise<void>;
  readonly exportBytes: () => Promise<Uint8Array>;
  readonly importBytes: (bytes: Uint8Array) => Promise<void>;
  getActiveTx: () => ActiveTx | null;
  setActiveTx: (tx: ActiveTx | null) => void;
  getTxGate: () => Promise<void> | null;
  setTxGate: (gate: Promise<void> | null) => void;
};

async function runSql(
  deps: OwnerHandlerDeps,
  sql: SqlWire,
  txClient?: SqlClient
): Promise<RunResult> {
  const c = txClient ?? (await deps.ensureOpen());
  return c.run(sqlFromWire(sql));
}

async function querySql<T extends Record<string, unknown>>(
  deps: OwnerHandlerDeps,
  sql: SqlWire,
  txClient?: SqlClient
): Promise<T[]> {
  const c = txClient ?? (await deps.ensureOpen());
  return c.query(sqlFromWire<T>(sql));
}

function requireTx(deps: OwnerHandlerDeps, txId: string): ActiveTx {
  const activeTx = deps.getActiveTx();
  if (activeTx === null || activeTx.txId !== txId) {
    const error = new Error(`Transaction ${txId} is not active`);
    error.name = 'TxAbortedError';
    (error as Error & { code?: string }).code = RPC_ERROR_TX_ABORTED;
    throw error;
  }
  deps.touchTxIdle(activeTx);
  return activeTx;
}

async function handleBeginTx(
  deps: OwnerHandlerDeps,
  request: RpcRequest
): Promise<RpcResponse> {
  let txId = '';
  await new Promise<void>((resolveBegin, rejectBegin) => {
    void deps
      .runExclusive(async () => {
        try {
          const c = await deps.ensureOpen();
          const id = deps.nextTxId();
          let resolveGate!: () => void;
          let rejectGate!: (error: unknown) => void;
          deps.setTxGate(
            new Promise<void>((resolve, reject) => {
              resolveGate = resolve;
              rejectGate = reject;
            })
          );
          await c.run(sqlFromWire({ sql: 'BEGIN', values: [] }));
          const activeTx: ActiveTx = {
            txId: id,
            client: deps.createBypassClient(c),
            idleTimerId: null,
            resolveGate,
            rejectGate,
          };
          deps.setActiveTx(activeTx);
          deps.touchTxIdle(activeTx);
          txId = id;
          resolveBegin();
          await deps.getTxGate();
        } catch (error: unknown) {
          rejectBegin(error);
          throw error;
        }
      })
      .catch(rejectBegin);
  });
  return { id: request.id, ok: true, result: { txId } };
}

async function handleStmtOp(
  deps: OwnerHandlerDeps,
  request: RpcRequest,
  kind: 'query' | 'run'
): Promise<RpcResponse> {
  const payload = request.payload as { stmtId: string; params: Value[] };
  const result = await deps.runExclusive(async () => {
    const stmt = deps.stmts.get(payload.stmtId);
    if (stmt === undefined) {
      throw new Error(`Unknown statement ${payload.stmtId}`);
    }
    if (kind === 'query') return stmt.query(payload.params);
    const out = await stmt.run(payload.params);
    deps.emitChanged();
    return out;
  });
  return { id: request.id, ok: true, result: result as never };
}

export async function handleOwnerRequest(
  deps: OwnerHandlerDeps,
  request: RpcRequest
): Promise<RpcResponse> {
  try {
    return await dispatchOwnerRequest(deps, request);
  } catch (error: unknown) {
    return {
      id: request.id,
      ok: false,
      error: serializeError(error),
    };
  }
}

async function dispatchOwnerRequest(
  deps: OwnerHandlerDeps,
  request: RpcRequest
): Promise<RpcResponse> {
  switch (request.op) {
    case 'query': {
      const rows = await deps.runExclusive(() =>
        querySql(deps, request.payload as SqlWire)
      );
      return { id: request.id, ok: true, result: rows };
    }
    case 'run': {
      const result = await deps.runExclusive(async () => {
        const out = await runSql(deps, request.payload as SqlWire);
        deps.emitChanged();
        return out;
      });
      return { id: request.id, ok: true, result };
    }
    case 'prepare': {
      const stmtId = await deps.runExclusive(async () => {
        const c = await deps.ensureOpen();
        const stmt = c.prepare(sqlFromWire(request.payload as SqlWire));
        const id = deps.nextStmtId();
        deps.stmts.set(id, stmt);
        return id;
      });
      return { id: request.id, ok: true, result: { stmtId } };
    }
    case 'stmtQuery':
      return handleStmtOp(deps, request, 'query');
    case 'stmtRun':
      return handleStmtOp(deps, request, 'run');
    case 'finalize': {
      const payload = request.payload as { stmtId: string };
      deps.stmts.delete(payload.stmtId);
      return { id: request.id, ok: true, result: null };
    }
    case 'beginTx':
      return handleBeginTx(deps, request);
    case 'txQuery': {
      const payload = request.payload as { txId: string; sql: SqlWire };
      const rows = await querySql(
        deps,
        payload.sql,
        requireTx(deps, payload.txId).client
      );
      return { id: request.id, ok: true, result: rows };
    }
    case 'txRun': {
      const payload = request.payload as { txId: string; sql: SqlWire };
      const result = await runSql(
        deps,
        payload.sql,
        requireTx(deps, payload.txId).client
      );
      return { id: request.id, ok: true, result };
    }
    case 'commitTx':
      return finishTx(deps, request, 'COMMIT', true);
    case 'rollbackTx':
      return finishTx(deps, request, 'ROLLBACK', false);
    case 'resetDatabase': {
      await deps.resetDatabase();
      return { id: request.id, ok: true, result: null };
    }
    case 'exportBytes': {
      const bytes = await deps.runExclusive(() => deps.exportBytes());
      return { id: request.id, ok: true, result: bytes };
    }
    case 'importBytes': {
      const payload = request.payload as { bytes: Uint8Array };
      await deps.runExclusive(() => deps.importBytes(payload.bytes));
      deps.emitChanged();
      return { id: request.id, ok: true, result: null };
    }
    case 'becomeOwner':
    case 'releaseOwner':
    case 'connect':
    case 'disconnect':
    case 'heartbeat':
      return { id: request.id, ok: true, result: null };
    default:
      throw new Error(`Unsupported op ${(request as RpcRequest).op}`);
  }
}

async function finishTx(
  deps: OwnerHandlerDeps,
  request: RpcRequest,
  sql: 'COMMIT' | 'ROLLBACK',
  emit: boolean
): Promise<RpcResponse> {
  const payload = request.payload as { txId: string };
  const tx = requireTx(deps, payload.txId);
  if (tx.idleTimerId !== null) {
    deps.timers.clearTimeout(tx.idleTimerId);
  }
  try {
    await tx.client.run(sqlFromWire({ sql, values: [] }));
  } finally {
    deps.setActiveTx(null);
    tx.resolveGate();
    deps.setTxGate(null);
  }
  if (emit) deps.emitChanged(payload.txId);
  return { id: request.id, ok: true, result: null };
}
