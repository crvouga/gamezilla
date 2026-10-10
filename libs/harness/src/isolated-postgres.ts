/** Each browser scenario gets a clone of its declared schema on the real wire. */

import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import { parseMockingbirdPostgresSnapshotEnvelope } from '@pkgs/sql-client-postgres-shared/mockingbird-postgres-snapshot';
import { ensureHarnessMockingbirdPostgresSeed } from './boot-harness-mockingbird-postgres';
import { bootHarnessPostgres } from './boot-harness-postgres';
import type { HarnessComposition } from './composition';

export async function isolatedPostgres(composition: HarnessComposition) {
  const store = new ObjectStoreImplInMemory();
  const { seedBytes } = await ensureHarnessMockingbirdPostgresSeed(composition);
  await store.put(
    'database.pgmm',
    parseMockingbirdPostgresSnapshotEnvelope(seedBytes),
    'application/octet-stream'
  );
  const server = await startMockingbirdPostgres({ port: 0, store });
  try {
    const handle = await bootHarnessPostgres(server.url);
    return {
      ...handle,
      async stop() {
        try {
          await handle.stop();
        } finally {
          await server.stop();
        }
      },
    };
  } catch (error) {
    await server.stop();
    throw error;
  }
}
