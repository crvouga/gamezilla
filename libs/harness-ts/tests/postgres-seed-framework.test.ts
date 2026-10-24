import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { compositionMigratePostgres } from '@libs/harness-ts/migrate-composition';
import { harnessPostgresSeedFingerprintSource } from '@libs/harness-ts/postgres-seed-fingerprint';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { withOutboxCausation } from '@pkgs/outbox-shared-ts/causation';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { outboxSchema } from '@pkgs/outbox-shared-ts/tables';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import {
  computeHarnessMockingbirdPostgresSeedFingerprint,
  ensureHarnessMockingbirdPostgresSeedBuffer,
  type HarnessMockingbirdPostgresMigrateHandle,
} from '@pkgs/sql-client-root-harness-ts/boot-harness-mockingbird-postgres';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { LEGACY_OUTBOX, priorFrameworkSeed } from './framework-seed-fixture';

test('a warm seed with the prior outbox schema rebuilds before a causal write', async () => {
  // regression: harness-seed-omits-framework-schema
  const composition = composeHarnessSlices('framework-seed-regression', []);
  const source = await harnessPostgresSeedFingerprintSource(
    join(import.meta.dir, '../../..'),
    composition
  );
  const priorSource = source
    .toString()
    .replace(
      JSON.stringify(outboxSchema.snapshot()),
      JSON.stringify(LEGACY_OUTBOX.snapshot())
    );
  // Every other input, including domain/migration/auth source, stays identical.
  expect(priorSource).not.toBe(source.toString());
  const store = new ObjectStoreImplInMemory();
  const seedKey = 'framework-seed-regression.pgmm.json';
  await store.put(seedKey, await priorFrameworkSeed(), 'application/json');
  await store.put(
    `${seedKey}.fingerprint`,
    new TextEncoder().encode(
      computeHarnessMockingbirdPostgresSeedFingerprint({
        fingerprintSource: priorSource,
      })
    ),
    'text/plain'
  );
  let migrations = 0;
  const args = {
    store,
    seedKey,
    fingerprintSource: source,
    migrate: async (handle: HarnessMockingbirdPostgresMigrateHandle) => {
      migrations += 1;
      await compositionMigratePostgres(composition)({
        ...handle,
        now: () => 0,
      });
      await handle.sqlClient.run(
        sql`INSERT INTO kv (id, key, value) VALUES (${'canonical'}, ${'canonical'}, ${'"current-canonical-value"'})`
      );
    },
  };
  const ready = await ensureHarnessMockingbirdPostgresSeedBuffer(args);
  expect(ready.didMigrate).toBe(true);
  expect(migrations).toBe(1);
  const client = SqlClientImplMockingbirdPostgres.open();
  await client.connect();
  try {
    client.importDatabaseBytes(ready.seedBytes);
    const Ping = createMessageNamespace('seed')(
      'ready',
      (value): value is Record<string, never> =>
        typeof value === 'object' && value !== null
    );
    await new Outbox({
      tx: withOutboxCausation(client, 'accepted-write'),
      env: { now: () => new Date(0), createId: () => 'ready' },
    }).send({ id: 'ready', message: Ping({}) });
    expect(
      await client.query(
        sql<{
          causation_id: string;
        }>`SELECT causation_id FROM outbox_events WHERE id = ${'ready'}`
      )
    ).toEqual([{ causation_id: 'accepted-write' }]);
    expect(
      await client.query(
        sql<{ value: unknown }>`SELECT value FROM kv WHERE key = ${'canonical'}`
      )
    ).toEqual([{ value: '"current-canonical-value"' }]);
    const indexes = await client.query(
      sql<{
        indexdef: string;
      }>`SELECT indexdef FROM pg_indexes WHERE tablename = ${'outbox_events'}`
    );
    expect(
      indexes.some((index) => index.indexdef.includes('causation_id'))
    ).toBe(true);
  } finally {
    await client.disconnect();
  }
  expect(
    (await ensureHarnessMockingbirdPostgresSeedBuffer(args)).didMigrate
  ).toBe(false);
  expect(migrations).toBe(1);
});
