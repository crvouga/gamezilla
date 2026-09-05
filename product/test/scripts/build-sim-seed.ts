// @io-wall-ok — warm UI-sim SQL seed via shared @product/sim
/**
 * Re-exports the shared seed builder. Prefer:
 * `bun run --filter @product/sim seed:sim-db`
 */
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import {
  computeSimPostgresMemSeedFp,
  ensureSimPostgresMemSeed,
  SIM_SEED_PGMM_PATH,
} from '@product/sim/setup/boot-sim-postgres-mem';

const log = createLogger({ name: 'sim:seed-db', now: wallClock.now });

async function main(): Promise<void> {
  const fingerprint = await computeSimPostgresMemSeedFp();
  const { didMigrate } = await ensureSimPostgresMemSeed();
  const action = didMigrate ? 'rebuilt' : 'cached';
  log.info(
    `[seed:sim-db] mem ${action} ${SIM_SEED_PGMM_PATH} (fingerprint=${fingerprint.slice(0, 12)}…)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
