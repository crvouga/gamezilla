// @io-wall-ok
/**
 * Boot loopback Postgres + Mockingbird S3 + EMQX for CI / fidelity-max tests.
 * Not used by `bun dev`.
 */
import { wallClock, wallTimers } from '@pkgs/clock';
import { startEmqxServer } from '@pkgs/emqx-server';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server';

import { runLocalMigrate } from './run-local-postgres-migrate';
import { runLocalSeed } from './run-local-postgres-seed';

export type LocalStackHandle = {
  readonly s3: Readonly<Record<string, string>>;
  stop(): Promise<void>;
};

export async function bootLocalStack(): Promise<LocalStackHandle> {
  const postgres = await startEmbeddedPostgres();
  const s3 = await startS3Server();
  const emqx = await startEmqxServer({
    clock: wallClock,
    timers: wallTimers,
    http: createGlobalHttpClient(),
  });
  await runLocalMigrate();
  await runLocalSeed();
  return {
    s3: {
      S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY,
      S3_BUCKET,
      S3_ENDPOINT: s3.endpoint,
      S3_REGION,
    },
    async stop() {
      emqx.stop();
      await s3.stop();
      await postgres.stop();
    },
  };
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
