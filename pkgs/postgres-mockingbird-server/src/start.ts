// @io-wall-ok — local database listener and snapshot storage composition root.
import { join } from 'node:path';
import { Database, Snapshot } from '@crvouga/mockingbird-service-postgres';
import {
  type ServeOptions,
  serve,
} from '@crvouga/mockingbird-service-postgres/wire';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readObjectBytes } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import {
  databaseUrlFor,
  POSTGRES_DATABASE,
  POSTGRES_PORT,
} from '@pkgs/postgres-local-shared/ports';

export type MockingbirdPostgresHandle = {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
};

export type StartMockingbirdPostgresOptions = {
  /** Zero selects an ephemeral port. */
  readonly port?: number;
  /** Persist PGMM on orderly shutdown; native cluster files are untouched. */
  readonly dataDir?: string;
  readonly store?: ObjectStore;
  readonly onLog?: ServeOptions['onLog'];
};

/** PostgreSQL protocol server backed entirely by Mockingbird, without native binaries. */
export async function startMockingbirdPostgres(
  options: StartMockingbirdPostgresOptions = {}
): Promise<MockingbirdPostgresHandle> {
  const dataDir = options.dataDir ?? join(import.meta.dirname, '../data');
  const store =
    options.store ??
    createNodeFsObjectStore({
      rootDir: dataDir,
      fs: wallNodeFs(),
      layout: 'tree',
    });
  const bytes = await readObjectBytes(store, 'database.pgmm');
  const database =
    bytes === null ? new Database() : Snapshot.decode(bytes).open();
  const server = await serve({
    database,
    url: databaseUrlFor(options.port ?? POSTGRES_PORT),
    ...(options.onLog === undefined ? {} : { onLog: options.onLog }),
  }).catch((error: unknown) => {
    database.close();
    throw error;
  });
  let stopping: Promise<void> | undefined;
  return {
    url: server.connectionString,
    port: server.port,
    stop() {
      stopping ??= (async () => {
        await server.close();
        try {
          await store.put(
            'database.pgmm',
            server.snapshot(POSTGRES_DATABASE).encode(),
            'application/octet-stream'
          );
        } finally {
          server.getDatabase(POSTGRES_DATABASE).close();
        }
      })();
      return stopping;
    },
  };
}
