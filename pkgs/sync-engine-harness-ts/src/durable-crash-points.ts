/**
 * Deterministic crash-point injection at the client's durable boundaries.
 *
 * Every write that reaches the client's local SQLite either commits on its own
 * (an autocommit statement) or inside one transaction. Each such commit is a
 * durable boundary, numbered from 1 per client in the order it happens. A run
 * can record the boundaries a script crosses, then replay the same script
 * with the client killed at boundary N: just before its commit (everything
 * the transaction wrote rolls back, as when the process dies mid-transaction)
 * or just after it (the commit is on disk, nothing that follows runs).
 *
 * A killed client never touches its storage again: every later call through
 * the engine's handle throws {@link HarnessProcessDied}. The storage itself
 * (the raw SQLite under the wrapper) survives, so a restart reopens exactly
 * what the dead process left behind.
 */

import type {
  PreparedStatement,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';

export type CrashMoment = 'beforeCommit' | 'afterCommit';

export type DurableCrashArm = {
  /** 1-based durable boundary index, counted per client from arming. */
  readonly at: number;
  readonly when: CrashMoment;
};

export type DurableBoundary = {
  readonly index: number;
  /** `statement` = autocommit write; `transaction` = one committed transaction. */
  readonly kind: 'statement' | 'transaction';
  /** Distinct `verb table` pairs written, in first-seen order. */
  readonly writes: readonly string[];
};

export type DurableCrash = {
  readonly clientId: string;
  readonly boundary: DurableBoundary;
  readonly when: CrashMoment;
};

/** Thrown by every storage call of a client the harness killed. */
export class HarnessProcessDied extends Error {
  constructor(clientId: string) {
    super(`harness: client ${clientId} process died at a durable boundary`);
    this.name = 'HarnessProcessDied';
  }
}

export type DurableCrashPointController = {
  /** Count this client's boundaries; its engine storage is wrapped from its next open. */
  readonly track: (clientId: string) => void;
  readonly tracks: (clientId: string) => boolean;
  /** Kill the client at one boundary (tracks it too). One-shot. */
  readonly arm: (clientId: string, arm: DurableCrashArm) => void;
  /** Boundaries this client crossed, in commit order (a killed one included). */
  readonly boundaries: (clientId: string) => readonly DurableBoundary[];
  readonly crashes: () => readonly DurableCrash[];
  readonly onKill: (listener: (clientId: string) => void) => void;
  /**
   * Wrap `raw` for the engine of `clientId`. `storage` is what a restart
   * reopens once this process dies — even when it dies while booting.
   */
  readonly wrap: <B>(
    clientId: string,
    raw: SqlClient,
    storage: B
  ) => SqlClient;
  readonly storage: <B>(clientId: string) => B | undefined;
};

const WRITE_RE =
  /^\s*(?:WITH\b[\s\S]*?\)\s*)?(INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TRIGGER|VIEW)(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+(?:TABLE|INDEX|TRIGGER|VIEW)(?:\s+IF\s+EXISTS)?|ALTER\s+TABLE|PRAGMA\s+user_version\s*=)\s*["`]?(\w*)/i;

/** `insert sync_engine_mutations`, `pragma user_version`, … or null for reads. */
export function classifyWrite(text: string): string | null {
  const match = WRITE_RE.exec(text);
  if (match === null) return null;
  const verb = (match[1] ?? '').trim().split(/\s+/)[0]!.toLowerCase();
  if (verb === 'pragma') return 'pragma user_version';
  return `${verb} ${match[2] ?? ''}`.trim();
}

type ClientState = {
  arm: DurableCrashArm | null;
  readonly log: DurableBoundary[];
};

type Generation = {
  readonly clientId: string;
  dead: boolean;
};

type Ctx = {
  readonly state: (clientId: string) => ClientState;
  readonly kill: (
    gen: Generation,
    boundary: DurableBoundary,
    when: CrashMoment
  ) => void;
};

function alive(gen: Generation): void {
  if (gen.dead) throw new HarnessProcessDied(gen.clientId);
}

function noteWrite(writes: string[], text: string): boolean {
  const label = classifyWrite(text);
  if (label === null) return false;
  if (!writes.includes(label)) writes.push(label);
  return true;
}

function wrapTx(gen: Generation, tx: SqlClient, writes: string[]): SqlClient {
  const guard = <T>(text: string, call: () => Promise<T>): Promise<T> => {
    alive(gen);
    noteWrite(writes, text);
    return call();
  };
  return {
    connect: () => tx.connect(),
    disconnect: () => tx.disconnect(),
    query: (q) => guard(q.sql, () => tx.query(q)),
    run: (q) => guard(q.sql, () => tx.run(q)),
    prepare: <T extends Record<string, unknown>>(
      q: Parameters<SqlClient['prepare']>[0]
    ): PreparedStatement<T> => {
      const prepared = tx.prepare(q) as PreparedStatement<T>;
      return {
        query: (params) => guard(q.sql, () => prepared.query(params)),
        run: (params) => guard(q.sql, () => prepared.run(params)),
      };
    },
    transaction: (fn) =>
      tx.transaction((inner) => fn(wrapTx(gen, inner, writes))),
  };
}

/**
 * One transaction on the raw (serialized) client. The boundary number is
 * taken inside the transaction body, so it follows commit order.
 */
async function durableTransaction<T>(
  ctx: Ctx,
  gen: Generation,
  inner: SqlClient,
  kind: DurableBoundary['kind'],
  fn: (tx: SqlClient) => Promise<T>
): Promise<T> {
  alive(gen);
  let killAfter: DurableBoundary | null = null;
  const result = await inner.transaction(async (tx) => {
    alive(gen);
    const writes: string[] = [];
    const value = await fn(wrapTx(gen, tx, writes));
    if (writes.length === 0) return value;
    const s = ctx.state(gen.clientId);
    const entry: DurableBoundary = {
      index: s.log.length + 1,
      kind,
      writes,
    };
    s.log.push(entry);
    const arm = s.arm?.at === entry.index ? s.arm : null;
    if (arm?.when === 'beforeCommit') {
      ctx.kill(gen, entry, 'beforeCommit');
      throw new HarnessProcessDied(gen.clientId);
    }
    if (arm?.when === 'afterCommit') {
      // Nothing queued behind this commit may run as the dead process.
      gen.dead = true;
      killAfter = entry;
    }
    return value;
  });
  if (killAfter !== null) {
    ctx.kill(gen, killAfter, 'afterCommit');
    throw new HarnessProcessDied(gen.clientId);
  }
  return result;
}

function wrapClient(ctx: Ctx, gen: Generation, inner: SqlClient): SqlClient {
  /** Reads run as-is; an autocommit write is a one-statement transaction. */
  const single = <T>(
    text: string,
    direct: () => Promise<T>,
    inTx: (tx: SqlClient) => Promise<T>
  ): Promise<T> => {
    alive(gen);
    if (classifyWrite(text) === null) return direct();
    return durableTransaction(ctx, gen, inner, 'statement', inTx);
  };
  return {
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    query: (q) => single(q.sql, () => inner.query(q), (tx) => tx.query(q)),
    run: (q) => single(q.sql, () => inner.run(q), (tx) => tx.run(q)),
    prepare: <T extends Record<string, unknown>>(
      q: Parameters<SqlClient['prepare']>[0]
    ): PreparedStatement<T> => {
      const prepared = inner.prepare(q) as PreparedStatement<T>;
      return {
        query: (params) =>
          single(
            q.sql,
            () => prepared.query(params),
            (tx) => (tx.prepare(q) as PreparedStatement<T>).query(params)
          ),
        run: (params) =>
          single(
            q.sql,
            () => prepared.run(params),
            (tx) => tx.prepare(q).run(params)
          ),
      };
    },
    transaction: (fn) => durableTransaction(ctx, gen, inner, 'transaction', fn),
  };
}

export function createDurableCrashPointController(): DurableCrashPointController {
  const states = new Map<string, ClientState>();
  const tracked = new Set<string>();
  const storages = new Map<string, unknown>();
  const crashes: DurableCrash[] = [];
  const listeners: ((clientId: string) => void)[] = [];
  const state = (clientId: string): ClientState => {
    let found = states.get(clientId);
    if (found === undefined) {
      found = { arm: null, log: [] };
      states.set(clientId, found);
    }
    return found;
  };
  const ctx: Ctx = {
    state,
    kill: (gen, boundary, when) => {
      gen.dead = true;
      state(gen.clientId).arm = null;
      crashes.push({ clientId: gen.clientId, boundary, when });
      for (const listener of listeners) listener(gen.clientId);
    },
  };
  return {
    track: (clientId) => {
      tracked.add(clientId);
      state(clientId);
    },
    tracks: (clientId) => tracked.has(clientId),
    arm: (clientId, arm) => {
      tracked.add(clientId);
      state(clientId).arm = arm;
    },
    boundaries: (clientId) => [...(states.get(clientId)?.log ?? [])],
    crashes: () => [...crashes],
    onKill: (listener) => {
      listeners.push(listener);
    },
    wrap: (clientId, raw, storage) => {
      storages.set(clientId, storage);
      return wrapClient(ctx, { clientId, dead: false }, raw);
    },
    storage: <B>(clientId: string) => storages.get(clientId) as B | undefined,
  };
}
