import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';

import {
  isActivePowerSyncDatabase,
  openPowerSyncDatabase,
} from './create-power-sync-database';
import {
  createAppPowerSyncSyncEngine,
  type CreateAppPowerSyncSyncEngineArgs,
} from './create-powersync-sync-engine';

type SyncEnginePool = {
  readonly ready: Map<string, SyncEngine>;
  readonly pending: Map<string, Promise<SyncEngine>>;
  readonly stableReady: Map<string, Promise<SyncEngine>>;
};

/**
 * Survives Metro/HMR. Per-identity SyncEngine wrappers stay warm so account
 * switches reuse the same engine after the DB pool reactivates the file.
 */
function getSyncEnginePool(): SyncEnginePool {
  const g = globalThis as typeof globalThis & {
    // V5: invalidate engines that wrapped writeTransaction with `{...tx}`
    // (prototype methods like execute were dropped; create-space then failed).
    __gamezillaSyncEnginePoolV5?: SyncEnginePool;
  };
  if (g.__gamezillaSyncEnginePoolV5 === undefined) {
    g.__gamezillaSyncEnginePoolV5 = {
      ready: new Map(),
      pending: new Map(),
      stableReady: new Map(),
    };
  }
  return g.__gamezillaSyncEnginePoolV5;
}

/** Synchronous peek — non-null when this identity was opened earlier this session. */
export function peekReadyAppSyncEngine(
  databaseName: string
): SyncEngine | null {
  return getSyncEnginePool().ready.get(databaseName) ?? null;
}

/**
 * Returns a pooled SyncEngine for `databaseName`, creating one on first visit.
 * Underlying DB activation (disconnect previous sync) happens inside create.
 */
export function getOrCreateAppPowerSyncSyncEngine(
  args: CreateAppPowerSyncSyncEngineArgs
): Promise<SyncEngine> {
  const pool = getSyncEnginePool();
  const ready = pool.ready.get(args.databaseName);
  if (ready !== undefined) {
    return openWarmEngine(args.databaseName, ready, pool);
  }
  const pending = pool.pending.get(args.databaseName);
  if (pending !== undefined) return pending;

  const created = createAppPowerSyncSyncEngine(args).then(
    (engine) => {
      pool.pending.delete(args.databaseName);
      pool.ready.set(args.databaseName, engine);
      const stable = Promise.resolve(engine);
      pool.stableReady.set(args.databaseName, stable);
      return engine;
    },
    (error: unknown) => {
      pool.pending.delete(args.databaseName);
      throw error;
    }
  );
  pool.pending.set(args.databaseName, created);
  return created;
}

/**
 * Warm path: re-activate the pooled DB when another identity was active.
 * When already active, return a stable Promise so React `useMemo` callers do
 * not allocate a new promise (and re-trigger boot effects) every render.
 */
function openWarmEngine(
  databaseName: string,
  engine: SyncEngine,
  pool: SyncEnginePool
): Promise<SyncEngine> {
  if (isActivePowerSyncDatabase(databaseName)) {
    const stable = pool.stableReady.get(databaseName);
    if (stable !== undefined) return stable;
    const resolved = Promise.resolve(engine);
    pool.stableReady.set(databaseName, resolved);
    return resolved;
  }
  pool.stableReady.delete(databaseName);
  const opened = openPowerSyncDatabase(databaseName).then(() => {
    const stable = Promise.resolve(engine);
    pool.stableReady.set(databaseName, stable);
    return engine;
  });
  pool.stableReady.set(databaseName, opened);
  return opened;
}
