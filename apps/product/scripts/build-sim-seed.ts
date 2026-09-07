// @io-wall-ok — warm UI-sim SQL seed cache before Jest
/**
 * Builds the postgres-mem sim seed when missing or fingerprint-stale
 * (`sim-backend-seed.pgmm.json`).
 *
 * Usage: `bun run --filter @apps/product seed:sim-db`
 */

import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import {
  computeSimPostgresMemSeedFp,
  ensureSimPostgresMemSeed,
  SIM_SEED_PGMM_PATH,
} from '../src/sim/setup/boot-sim-postgres-mem';

const log = createLogger({ name: 'sim:seed-db', now: wallClock.now });

async function main(): Promise<void> {
  const fingerprint = await computeSimPostgresMemSeedFp();
  const { didMigrate } = await ensureSimPostgresMemSeed();
  log.info('sim seed ready', {
    backend: 'mem',
    path: SIM_SEED_PGMM_PATH,
    fingerprint,
    didMigrate,
  });
}

await main();
