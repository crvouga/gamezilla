/**
 * Foreground entry for `@apps/postgres` `dev` / `preview`.
 * Starts embedded Postgres, migrates, seeds, then keeps the process alive
 * so Turbo SIGINT/SIGTERM tears the cluster down cleanly.
 */
import {
  createEmbeddedPostgres,
  ensureAppDatabase,
  ensureClusterInitialised,
  LOCAL_DATABASE_URL,
} from './cluster';
import { runLocalMigrate } from './migrate';
import { POSTGRES_PORT } from './ports';
import { runLocalSeed } from './seed';

const pg = createEmbeddedPostgres();
let shuttingDown = false;

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await pg.stop();
  } catch (error) {
    process.stderr.write(
      `[postgres] stop error: ${error instanceof Error ? error.message : String(error)}\n`
    );
  }
  process.exit(exitCode);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    const codes: Record<string, number> = {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
    };
    void shutdown(codes[sig] ?? 1);
  });
}

try {
  await ensureClusterInitialised(pg);
  await pg.start();
  await ensureAppDatabase(pg);
  process.stdout.write(
    `[postgres] listening postgresql://127.0.0.1:${String(POSTGRES_PORT)}/…\n`
  );
  process.stdout.write(`[postgres] DATABASE_URL=${LOCAL_DATABASE_URL}\n`);
  await runLocalMigrate();
  await runLocalSeed();
  process.stdout.write('[postgres] ready (persistent)\n');
  await new Promise<void>(() => {
    // Keep the event loop alive until signal shutdown.
  });
} catch (error) {
  process.stderr.write(
    `[postgres] failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  await shutdown(1);
}
