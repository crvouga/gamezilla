import { describe, expect, test } from 'bun:test';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import type { ActiveTx, OwnerHandlerDeps } from '@pkgs/sql-client-sqlite-web-shared/owner-handlers';
import { handleOwnerRequest } from '@pkgs/sql-client-sqlite-web-shared/owner-handlers';
import { RPC_ERROR_TX_ABORTED } from '@pkgs/sql-client-sqlite-web-shared/rpc';

function mockTimers() {
  return {
    setTimeout: (fn: () => void, _ms: number) => {
      // Idle timers fire only when tests call the handle manually.
      return { fn };
    },
    clearTimeout: (_id: unknown) => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  };
}

function createAsyncMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const done = tail.then(fn, fn);
    tail = done.then(
      () => undefined,
      () => undefined
    );
    return done;
  };
}

function createStubClient(): SqlClient & {
  prepare: SqlClient['prepare'];
  readonly log: string[];
} {
  const log: string[] = [];
  const client: SqlClient & { prepare: SqlClient['prepare']; log: string[] } = {
    log,
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: async (q) => {
      log.push(`query:${q.sql}`);
      return [{ ok: 1 }] as never;
    },
    run: async (q) => {
      log.push(`run:${q.sql}`);
      return { changes: 1, lastInsertRowid: 1 };
    },
    prepare: <T extends Record<string, unknown>>(q: { sql: string }) => {
      log.push(`prepare:${q.sql}`);
      const stmt: PreparedStatement<T> = {
        query: async (params) => {
          log.push(`stmtQuery:${JSON.stringify(params ?? [])}`);
          return [{ v: 1 }] as unknown as T[];
        },
        run: async (params) => {
          log.push(`stmtRun:${JSON.stringify(params ?? [])}`);
          return { changes: 1, lastInsertRowid: 2 };
        },
      };
      return stmt;
    },
    transaction: async (fn) => fn(client),
  };
  return client;
}

function createDeps(
  overrides?: Partial<OwnerHandlerDeps> & { resetCalls?: string[] }
): OwnerHandlerDeps {
  const timers = mockTimers();
  const runExclusive = createAsyncMutex();
  const client = createStubClient();
  const stmts = new Map<string, PreparedStatement<Record<string, unknown>>>();
  let stmtN = 0;
  let txN = 0;
  let activeTx: ActiveTx | null = null;
  let txGate: Promise<void> | null = null;
  const resetCalls = overrides?.resetCalls ?? [];

  const deps: OwnerHandlerDeps = {
    timers,
    runExclusive,
    ensureOpen: async () => client,
    emitChanged: () => undefined,
    stmts,
    nextStmtId: () => `stmt_${++stmtN}`,
    nextTxId: () => `tx_${++txN}`,
    touchTxIdle: (tx) => {
      if (tx.idleTimerId !== null) timers.clearTimeout(tx.idleTimerId);
      tx.idleTimerId = timers.setTimeout(() => undefined, 10_000);
    },
    createBypassClient: (owner) => owner,
    resetDatabase: async () => {
      resetCalls.push('reset');
      if (activeTx !== null) {
        activeTx.rejectGate(new Error('aborted by reset'));
        activeTx = null;
        txGate = null;
      }
    },
    exportBytes: async () => new Uint8Array([1, 2, 3]),
    importBytes: async () => undefined,
    getActiveTx: () => activeTx,
    setActiveTx: (tx) => {
      activeTx = tx;
    },
    getTxGate: () => txGate,
    setTxGate: (gate) => {
      txGate = gate;
    },
    ...overrides,
  };
  return deps;
}

describe('handleOwnerRequest', () => {
  test('query and run succeed', async () => {
    const deps = createDeps();
    const q = await handleOwnerRequest(deps, {
      id: '1',
      dbName: 'db',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    expect(q).toEqual({ id: '1', ok: true, result: [{ ok: 1 }] });
    const r = await handleOwnerRequest(deps, {
      id: '2',
      dbName: 'db',
      op: 'run',
      payload: { sql: 'INSERT INTO t DEFAULT VALUES', values: [] },
    });
    expect(r.ok).toBe(true);
  });

  test('begin → txQuery/txRun → commit', async () => {
    const deps = createDeps();
    const begin = await handleOwnerRequest(deps, {
      id: 'b',
      dbName: 'db',
      op: 'beginTx',
      payload: {},
    });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    const txId = (begin.result as { txId: string }).txId;

    const q = await handleOwnerRequest(deps, {
      id: 'q',
      dbName: 'db',
      op: 'txQuery',
      payload: { txId, sql: { sql: 'SELECT 1', values: [] } },
    });
    expect(q.ok).toBe(true);

    const run = await handleOwnerRequest(deps, {
      id: 'r',
      dbName: 'db',
      op: 'txRun',
      payload: {
        txId,
        sql: { sql: 'UPDATE t SET x = 1', values: [] },
      },
    });
    expect(run.ok).toBe(true);

    const commit = await handleOwnerRequest(deps, {
      id: 'c',
      dbName: 'db',
      op: 'commitTx',
      payload: { txId },
    });
    expect(commit).toEqual({ id: 'c', ok: true, result: null });
    expect(deps.getActiveTx()).toBeNull();
  });

  test('rollback clears active tx', async () => {
    const deps = createDeps();
    const begin = await handleOwnerRequest(deps, {
      id: 'b',
      dbName: 'db',
      op: 'beginTx',
      payload: {},
    });
    if (!begin.ok) throw new Error('begin failed');
    const txId = (begin.result as { txId: string }).txId;
    const rollback = await handleOwnerRequest(deps, {
      id: 'rb',
      dbName: 'db',
      op: 'rollbackTx',
      payload: { txId },
    });
    expect(rollback.ok).toBe(true);
    expect(deps.getActiveTx()).toBeNull();
  });

  test('stale txId returns E_TX_ABORTED', async () => {
    const deps = createDeps();
    const res = await handleOwnerRequest(deps, {
      id: 'q',
      dbName: 'db',
      op: 'txQuery',
      payload: {
        txId: 'missing',
        sql: { sql: 'SELECT 1', values: [] },
      },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe(RPC_ERROR_TX_ABORTED);
  });

  test('prepare / stmtQuery / stmtRun / finalize', async () => {
    const deps = createDeps();
    const prep = await handleOwnerRequest(deps, {
      id: 'p',
      dbName: 'db',
      op: 'prepare',
      payload: { sql: 'SELECT 1', values: [] },
    });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    const { stmtId } = prep.result as { stmtId: string };

    const sq = await handleOwnerRequest(deps, {
      id: 'sq',
      dbName: 'db',
      op: 'stmtQuery',
      payload: { stmtId, params: [] },
    });
    expect(sq.ok).toBe(true);

    const sr = await handleOwnerRequest(deps, {
      id: 'sr',
      dbName: 'db',
      op: 'stmtRun',
      payload: { stmtId, params: [] },
    });
    expect(sr.ok).toBe(true);
    if (!sr.ok) return;
    expect((sr.result as RunResult).changes).toBe(1);

    const fin = await handleOwnerRequest(deps, {
      id: 'f',
      dbName: 'db',
      op: 'finalize',
      payload: { stmtId },
    });
    expect(fin).toEqual({ id: 'f', ok: true, result: null });
    expect(deps.stmts.has(stmtId)).toBe(false);
  });

  test('thrown errors serialize to ok:false', async () => {
    const deps = createDeps({
      ensureOpen: async () => {
        throw new Error('boom');
      },
    });
    const res = await handleOwnerRequest(deps, {
      id: '1',
      dbName: 'db',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toBe('boom');
  });

  test('resetDatabase invokes deps and clears active tx', async () => {
    const resetCalls: string[] = [];
    const deps = createDeps({ resetCalls });
    const begin = await handleOwnerRequest(deps, {
      id: 'b',
      dbName: 'db',
      op: 'beginTx',
      payload: {},
    });
    expect(begin.ok).toBe(true);
    const res = await handleOwnerRequest(deps, {
      id: 'r',
      dbName: 'db',
      op: 'resetDatabase',
      payload: {},
    });
    expect(res).toEqual({ id: 'r', ok: true, result: null });
    expect(resetCalls).toEqual(['reset']);
    expect(deps.getActiveTx()).toBeNull();
  });
});
