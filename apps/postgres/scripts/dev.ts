/**
 * Foreground entry for `@apps/postgres` `dev` / `preview`.
 * Starts embedded Postgres, migrates, seeds, then keeps the process alive
 * so Turbo SIGINT/SIGTERM tears the cluster down cleanly.
 */
import {
  createEmbeddedPostgres,
  ensureAppDatabase,
  ensureClusterInitialised,
  formatUnknownError,
  LOCAL_DATABASE_URL,
  wipeClusterData,
} from './cluster';
import { runLocalMigrate } from './migrate';
import { POSTGRES_PORT } from './ports';
import { runLocalSeed } from './seed';

let pg = createEmbeddedPostgres();
let shuttingDown = false;

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await pg.stop();
  } catch (error) {
    process.stderr.write(
      `[postgres] stop error: ${formatUnknownError(error)}\n`
    );
  }
  process.exit(exitCode);
}

function isRecoverableStartError(error: unknown): boolean {
  // embedded-postgres often rejects with undefined while FATAL goes to onError.
  if (error === undefined || error === null) return true;
  const message = formatUnknownError(error);
  if (message.length === 0 || message === 'undefined' || message === '{}') {
    return true;
  }
  return (
    /pg_notify/i.test(message) ||
    /could not open directory/i.test(message) ||
    /database files are incompatible/i.test(message)
  );
}

async function startCluster(): Promise<void> {
  await ensureClusterInitialised(pg);
  try {
    await pg.start();
  } catch (error) {
    if (!isRecoverableStartError(error)) throw error;
    process.stderr.write(
      `[postgres] start failed (${formatUnknownError(error)}); reinitialising cluster…\n`
    );
    try {
      await pg.stop();
    } catch {
      // already down
    }
    wipeClusterData();
    pg = createEmbeddedPostgres();
    await ensureClusterInitialised(pg);
    await pg.start();
  }
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
  await startCluster();
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
  process.stderr.write(`[postgres] failed: ${formatUnknownError(error)}\n`);
  await shutdown(1);
}
