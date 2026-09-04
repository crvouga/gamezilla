// @io-wall-ok — warm UI-sim SQL seed via shared @product/sim
/**
 * Re-exports the shared seed builder. Prefer:
 * `bun run --filter @product/sim seed:sim-db`
 */
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { resolveSimSqlBackend } from '@product/sim/fabric/sim-sql-backend';
import {
  computeSimPgliteSeedFp,
  ensureSimPgliteSeed,
  SIM_SEED_PGLITE_PATH,
} from '@product/sim/setup/boot-sim-pglite';
import {
  computeSimPostgresMemSeedFp,
  ensureSimPostgresMemSeed,
  SIM_SEED_PGMM_PATH,
} from '@product/sim/setup/boot-sim-postgres-mem';

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
