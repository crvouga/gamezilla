import type { SqlClient } from './interface';
import { isTransientConflict } from './transient-conflict';

/** Attempts in all, the first included, before a conflict is a failure. */
export const CONFLICT_RETRY_ATTEMPTS = 6;
/** The first retry waits up to this long; each later one up to twice the last. */
const BASE_BACKOFF_MS = 25;
const MAX_BACKOFF_MS = 400;

/**
 * How a retry waits before running the work again. Writers to one hot row
 * (a room's push sequence, a device's presence) keep colliding if they rerun
 * at once, so each retry waits a random share of an exponentially growing
 * window. Injected by the composition root (`Timers`, `random`); without one,
 * retries run again at once.
 */
export type ConflictBackoff = {
  readonly wait: (ms: number) => Promise<void>;
  /** A uniform number in [0, 1). */
  readonly random: () => number;
};

/** The longest a retry after `attempt` failed attempts may wait. */
export function backoffWindowMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
}

const RETRYING = Symbol('retries-conflicting-transactions');

/** Whether `client`'s own transactions already rerun on conflict. */
function retriesConflicts(client: SqlClient): boolean {
  return (client as { [RETRYING]?: true })[RETRYING] === true;
}

/**
 * Run `work` (one whole transaction) again while the database aborts it for
 * a serialization conflict or deadlock, up to `CONFLICT_RETRY_ATTEMPTS`.
 * Only confirmed conflicts are retried: an unknown connection failure may
 * have committed. Work that has effects outside the database must keep them
 * after commit.
 */
export async function withConflictRetry<T>(
  work: () => Promise<T>,
  backoff?: ConflictBackoff
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= CONFLICT_RETRY_ATTEMPTS || !isTransientConflict(error))
        throw error;
      if (backoff !== undefined)
        await backoff.wait(
          Math.floor(backoff.random() * backoffWindowMs(attempt))
        );
    }
  }
}

/**
 * One transaction on `db`, rerun from the start while it loses a conflict.
 * A client from `retryingConflicts` already does that with its backoff, so
 * it is run once here instead of multiplying the attempts.
 */
export async function retryConflictingTransaction<T>(
  db: SqlClient,
  body: (tx: SqlClient) => Promise<T>
): Promise<T> {
  if (retriesConflicts(db)) return db.transaction(body);
  return withConflictRetry(() => db.transaction(body));
}

/**
 * `client` whose top-level transactions retry conflicts with `backoff`.
 * Savepoints inside a transaction are never retried on their own: a
 * conflict aborts the whole transaction, which is what reruns.
 */
export function retryingConflicts(
  client: SqlClient,
  backoff: ConflictBackoff
): SqlClient {
  const retrying: SqlClient = {
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    query: (query) => client.query(query),
    run: (query) => client.run(query),
    prepare: (query) => client.prepare(query),
    transaction: (fn) =>
      withConflictRetry(() => client.transaction(fn), backoff),
  };
  return Object.assign(retrying, { [RETRYING]: true as const });
}

/** A backoff that waits on injected timers. */
export function timerBackoff(input: {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly random: () => number;
}): ConflictBackoff {
  return {
    wait: (ms) =>
      new Promise<void>((resolve) => {
        input.setTimeout(resolve, ms);
      }),
    random: input.random,
  };
}
