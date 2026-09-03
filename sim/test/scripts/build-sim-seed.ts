// @io-wall-ok — warm UI-sim SQL seed cache before Jest
/**
 * Builds the active sim backend seed when missing or fingerprint-stale.
 * Default (`SIM_SQL_BACKEND=real`): `sim-backend-seed.pglite.bin`
 * Override `SIM_SQL_BACKEND=mem`: `sim-backend-seed.pgmm.json`
 *
 * Usage: `bun run --filter @sim/test seed:sim-db`
 */

import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { resolveSimSqlBackend } from '@sim/console/sim/sim-sql-backend';
import {
  computeSimPgliteSeedFp,
  ensureSimPgliteSeed,
  SIM_SEED_PGLITE_PATH,
} from '../src/setup/boot-sim-pglite';
import {
  computeSimPostgresMemSeedFp,
  ensureSimPostgresMemSeed,
  SIM_SEED_PGMM_PATH,
} from '../src/setup/boot-sim-postgres-mem';

const log = createLogger({ name: 'sim:seed-db', now: wallClock.now });

async function main(): Promise<void> {
  const backend = resolveSimSqlBackend();
  if (backend === 'mem') {
    const fingerprint = await computeSimPostgresMemSeedFp();
    const { didMigrate } = await ensureSimPostgresMemSeed();
    const action = didMigrate ? 'rebuilt' : 'cached';
    log.info(
      `[seed:sim-db] mem ${action} ${SIM_SEED_PGMM_PATH} (fingerprint=${fingerprint.slice(0, 12)}…)`
    );
    return;
  }
  const fingerprint = await computeSimPgliteSeedFp();
  const { didMigrate } = await ensureSimPgliteSeed();
  const action = didMigrate ? 'rebuilt' : 'cached';
  log.info(
    `[seed:sim-db] real ${action} ${SIM_SEED_PGLITE_PATH} (fingerprint=${fingerprint.slice(0, 12)}…)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
