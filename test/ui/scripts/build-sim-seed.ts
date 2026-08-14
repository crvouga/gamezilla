// @io-wall-ok — warm UI-sim SQLite seed cache before Jest
/**
 * Builds `test/ui/.cache/sim-backend-seed.sqlite` when missing or fingerprint-
 * stale. The harness rebuilds lazily if this is skipped.
 *
 * Usage: `bun run --filter @test/ui seed:sim-db`
 * (runs under Node via tsx — better-sqlite3 NAPI is unreliable under Bun)
 */

import { wallIo } from '@pkgs/io';
import {
  computeSimSeedFingerprint,
  ensureSimSeedBuffer,
  SIM_SEED_SQLITE_PATH,
} from '../src/setup/boot-sim-sqlite';
import { migrateSimSqlite } from '../src/setup/migrate-sim-sqlite';

async function main(): Promise<void> {
  const io = wallIo();
  const fingerprint = await computeSimSeedFingerprint();
  const { didMigrate } = await ensureSimSeedBuffer({
    migrate: async (handle) => {
      await migrateSimSqlite({
        sqlClient: handle.sqlClient,
        io,
      });
    },
  });
  const action = didMigrate ? 'rebuilt' : 'cached';
  console.log(
    `[seed:sim-db] ${action} ${SIM_SEED_SQLITE_PATH} (fingerprint=${fingerprint.slice(0, 12)}…)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
