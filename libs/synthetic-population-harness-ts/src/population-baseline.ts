/**
 * The Synthetic Population a scenario starts from. On a server of the
 * world's own there is none yet. A localhost stack outlives one scenario,
 * so the one an earlier scenario left is retired first.
 */
import type { SyntheticPopulationPorts } from '@libs/synthetic-population-server-ts/records';
import { isoAt } from '@libs/synthetic-population-server-ts/records';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import {
  DEFAULT_SYNTHETIC_POPULATION_CONFIG,
  type SyntheticPopulationConfig,
} from '@libs/synthetic-population-shared-ts/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

function fresh(config: SyntheticPopulationConfig): boolean {
  return (
    Object.keys(
      DEFAULT_SYNTHETIC_POPULATION_CONFIG
    ) as (keyof SyntheticPopulationConfig)[]
  ).every(
    (key) =>
      key === 'revision' ||
      config[key] === DEFAULT_SYNTHETIC_POPULATION_CONFIG[key]
  );
}

/**
 * Retire the Synthetic Population an earlier scenario left (its users let
 * go and removed, its workers gone, its pending commands dropped) and put
 * the configuration back as a fresh deployment has it. With nothing left
 * behind, nothing is written.
 */
export async function retireEarlierPopulation(
  db: SqlClient,
  ports: SyntheticPopulationPorts
): Promise<void> {
  const now = isoAt(ports.clock.now());
  await db.transaction(async (tx) => {
    await tx.run(
      sql`UPDATE population_users SET worker_id = ${null}, lease_until = ${null}, activity = ${'offline'}, deleted_at = ${now}, updated_at = ${now} WHERE deleted_at IS NULL`
    );
    await tx.run(
      sql`UPDATE population_workers SET deleted_at = ${now}, updated_at = ${now} WHERE deleted_at IS NULL`
    );
    await tx.run(
      sql`UPDATE population_commands SET deleted_at = ${now}, updated_at = ${now} WHERE deleted_at IS NULL`
    );
  });
  const config = await new SyntheticPopulationRepository(db, ports).config();
  if (fresh(config)) return;
  const configured = await new SyntheticPopulationAdministration(
    db,
    ports
  ).configure(
    { ...DEFAULT_SYNTHETIC_POPULATION_CONFIG, revision: config.revision },
    'harness-baseline'
  );
  if (configured === null)
    throw new Error('The Synthetic Population changed while it was retired');
}
