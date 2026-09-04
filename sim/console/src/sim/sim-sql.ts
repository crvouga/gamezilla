/**
 * Sim SQL handles — thin wrappers over {@link getSimSqlFabric}.
 * Engine imports live only in fabric-mem / fabric-real.
 */

import type { Clock } from '@pkgs/clock';
import { getSimSqlFabric } from './sim-sql-fabric';
import type { SimSqlHandle } from './sim-sql-handle';

export {
  DEFAULT_SIM_SQL_BACKEND,
  resolveSimSqlBackend,
  resolveSimSqlRuntime,
  type SimSqlBackend,
  type SimSqlRuntime,
} from './sim-sql-backend';
export {
  clearSimSqlFabricCache,
  getSimSqlFabric,
  type SimSqlFabric,
} from './sim-sql-fabric';
export type { SimSqlHandle } from './sim-sql-handle';
export { handleBoundSqlClient, sharedSqlClient } from './sim-sql-handle';

/** @deprecated Prefer {@link openFreshSimClientSql}. */
export async function openFreshSimSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  return openFreshSimClientSql(logicalName, clock);
}

export async function openFreshSimClientSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  return getSimSqlFabric().openClient({ logicalName, clock });
}

export async function openFreshSimServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  return getSimSqlFabric().openServer({ logicalName, clock });
}

/**
 * Open a server handle from a post-migrate seed envelope.
 * Caller must not run migrate again.
 */
export async function openSimServerSqlFromSeedBytes(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSqlHandle> {
  return getSimSqlFabric().openServer({
    logicalName,
    clock,
    seedBytes,
  });
}

/** @deprecated Sync open removed — use {@link openFreshSimClientSql}. */
export function openSimSqlHandle(
  _logicalName: string,
  _clock: Clock
): SimSqlHandle {
  throw new Error(
    'openSimSqlHandle is async-only now; use openFreshSimClientSql'
  );
}

/** @deprecated Sync open removed — use {@link openFreshSimServerSql}. */
export function openSimServerSqlHandle(
  _logicalName: string,
  _clock: Clock
): SimSqlHandle {
  throw new Error(
    'openSimServerSqlHandle is async-only now; use openFreshSimServerSql'
  );
}
