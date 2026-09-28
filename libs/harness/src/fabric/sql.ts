/**
 * Harness SQL handles — thin wrappers over {@link getHarnessSqlEngines}.
 * Engine imports live only in fabric-mem.
 */

import type { Clock } from '@pkgs/clock';
import { getHarnessSqlEngines } from './sql-engines';
import type { HarnessSql } from './sql-types';

export {
  DEFAULT_HARNESS_SQL_BACKEND,
  type HarnessSqlBackend,
  type HarnessSqlRuntime,
  resolveHarnessSqlBackend,
  resolveHarnessSqlRuntime,
} from './sql-backend';
export {
  clearHarnessSqlEnginesCache,
  getHarnessSqlEngines,
  type HarnessSqlEngines,
} from './sql-engines';
export type { HarnessSql } from './sql-types';
export { handleBoundSqlClient, sharedSqlClient } from './sql-types';

export async function openFreshHarnessClientSql(
  logicalName: string,
  clock: Clock
): Promise<HarnessSql> {
  return getHarnessSqlEngines().openClient({ logicalName, clock });
}

export async function openFreshHarnessServerSql(
  logicalName: string,
  clock: Clock
): Promise<HarnessSql> {
  return getHarnessSqlEngines().openServer({ logicalName, clock });
}

/**
 * Open a server handle from a post-migrate seed envelope.
 * Caller must not run migrate again.
 */
export async function openHarnessServerSqlFromSeedBytes(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<HarnessSql> {
  return getHarnessSqlEngines().openServer({
    logicalName,
    clock,
    seedBytes,
  });
}
