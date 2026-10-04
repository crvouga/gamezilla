/**
 * Harness SQL handles — thin wrappers over {@link getHarnessSqlEngines}.
 * Engine imports live only in fabric-mem.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import { getHarnessSqlEngines } from './sql-engines';
import type { HarnessSql } from './sql-types';

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
