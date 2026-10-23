// @io-wall-ok — localhost stack composition root.
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createPgPool } from '@pkgs/sql-client-postgres-server-ts/connect';
import { localPopulationConfig } from './local-population-config';

/** Configure through the ordinary use case before any worker can claim a lease. */
export async function configureLocalPopulation(
  databaseUrl: string,
  workers: number
) {
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    const administration = new SyntheticPopulationAdministration(sqlClient, {
      clock: wallClock,
      createId: () => crypto.randomUUID(),
      // No clients exist yet; workers read configuration when registering.
      notify: () => Promise.resolve(),
    });
    const { config } = await administration.overview();
    const configured = await administration.configure(
      localPopulationConfig(config, workers),
      'localhost-stack'
    );
    if (configured === null)
      throw new Error('Local population configuration changed during startup');
  } finally {
    await pool.end();
  }
}
