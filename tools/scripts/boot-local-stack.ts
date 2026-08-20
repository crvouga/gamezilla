// @io-wall-ok
/**
 * Boot loopback Postgres + MinIO + EMQX for CI / fidelity-max tests.
 * Not used by `bun dev`.
 */
import { startEmqxServer } from '@pkgs/emqx-server';
import { startMinioServer } from '@pkgs/minio-server';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';

import { runLocalMigrate } from '../../apps/server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../apps/server/scripts/run-local-postgres-seed';

export type LocalStackHandle = {
  stop(): Promise<void>;
};

export async function bootLocalStack(): Promise<LocalStackHandle> {
  const postgres = await startEmbeddedPostgres();
  const minio = await startMinioServer();
  const emqx = await startEmqxServer();
  await runLocalMigrate();
  await runLocalSeed();
  return {
    async stop() {
      emqx.stop();
      minio.stop();
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
