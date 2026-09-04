/**
 * Sim SQL handles — thin wrappers over {@link getSimSqlEngines}.
 * Engine imports live only in fabric-mem / fabric-real.
 */

import type { Clock } from '@pkgs/clock';
import { getSimSqlEngines } from './sim-sql-engines';
import type { SimSql } from './sim-sql-types';

export {
  DEFAULT_SIM_SQL_BACKEND,
  resolveSimSqlBackend,
  resolveSimSqlRuntime,
  type SimSqlBackend,
  type SimSqlRuntime,
} from './sim-sql-backend';
export {
  clearSimSqlEnginesCache,
  getSimSqlEngines,
  type SimSqlEngines,
} from './sim-sql-engines';
export type { SimSql } from './sim-sql-types';
export { handleBoundSqlClient, sharedSqlClient } from './sim-sql-types';

export async function openFreshSimClientSql(
  logicalName: string,
  clock: Clock
): Promise<SimSql> {
  return getSimSqlEngines().openClient({ logicalName, clock });
}

export async function openFreshSimServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSql> {
  return getSimSqlEngines().openServer({ logicalName, clock });
}

/**
 * Open a server handle from a post-migrate seed envelope.
 * Caller must not run migrate again.
 */
export async function openSimServerSqlFromSeedBytes(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSql> {
  return getSimSqlEngines().openServer({
    logicalName,
    clock,
    seedBytes,
  });
}
