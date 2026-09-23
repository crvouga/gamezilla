// @io-wall-ok
/**
 * Boot loopback Postgres + MinIO + EMQX for the localhost profile / CI.
 * Used by `bun start:localhost` and `bun e2e`.
 */

import { wallClock, wallTimers } from '@pkgs/clock';
import { startEmqxServer } from '@pkgs/emqx-server';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { startMinioServer } from '@pkgs/minio-server';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';

import { runLocalMigrate } from '../../apps/server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../apps/server/scripts/run-local-postgres-seed';

export type LocalStackHandle = {
  /** Migrated database the Workers should use. */
  readonly databaseUrl: string;
  stop(): Promise<void>;
};

export type BootLocalStackOptions = {
  /**
   * Database on the embedded cluster. Default is the dev database; `bun e2e`
   * passes its own so per-test resets never touch dev data.
   */
  readonly database?: string;
  /** Load the full chess puzzle file (dev only; e2e seeds its fixtures). */
  readonly seed?: boolean;
};

export async function bootLocalStack(
  options: BootLocalStackOptions = {}
): Promise<LocalStackHandle> {
  const postgres = await startEmbeddedPostgres();
  let minio: Awaited<ReturnType<typeof startMinioServer>> | undefined;
  let emqx: Awaited<ReturnType<typeof startEmqxServer>> | undefined;
  try {
    minio = await startMinioServer();
    await import('../../pkgs/emqx-server/scripts/setup');
    emqx = await startEmqxServer({
      clock: wallClock,
      timers: wallTimers,
      http: createGlobalHttpClient(),
    });
    const databaseUrl =
      options.database === undefined
        ? postgres.url
        : await postgres.ensureDatabase(options.database);
    await runLocalMigrate(databaseUrl);
    if (options.seed !== false) await runLocalSeed(databaseUrl);
    return {
      databaseUrl,
      async stop() {
        await emqx?.stop();
        minio?.stop();
        await postgres.stop();
      },
    };
  } catch (error) {
    await emqx?.stop();
    minio?.stop();
    await postgres.stop();
    throw error;
  }
}

if (import.meta.main) {
  const handle = await bootLocalStack();
  process.stdout.write('[stack] ready (Ctrl-C to stop)\n');
  const stop = () => {
    void handle.stop().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise<void>(() => {
    // keep alive
  });
}
