// @io-wall-ok
/**
 * Boot loopback Postgres + MinIO + EMQX for the localhost profile / CI.
 * Used by `bun start:localhost`.
 */

import { wallClock, wallTimers } from '@pkgs/clock';
import { startEmqxServer } from '@pkgs/emqx-server';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { startMinioServer } from '@pkgs/minio-server';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';

import { runLocalMigrate } from '../../apps/server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../apps/server/scripts/run-local-postgres-seed';

export type LocalStackHandle = {
  stop(): Promise<void>;
};

export async function bootLocalStack(): Promise<LocalStackHandle> {
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
    await runLocalMigrate();
    await runLocalSeed();
    return {
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
