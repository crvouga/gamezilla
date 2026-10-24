import { expect, test } from 'bun:test';
import { harnessPostgresSchemas } from '@libs/harness-ts/postgres-schemas';
import { harnessPostgresSeedSource } from '@libs/harness-ts/postgres-seed-fingerprint';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import type { Snapshot } from '@pkgs/db-schema-root-shared-ts/types';
import { computeHarnessMockingbirdPostgresSeedFingerprint } from '@pkgs/sql-client-root-harness-ts/boot-harness-mockingbird-postgres';

const FIXED = {
  name: 'schema-inputs',
  migrate: 'unchanged migration source',
  authSecret: 'unchanged harness secret',
  authSource: 'unchanged auth source',
};
function fingerprint(schemas: readonly Snapshot[]) {
  return computeHarnessMockingbirdPostgresSeedFingerprint({
    fingerprintSource: harnessPostgresSeedSource({ ...FIXED, schemas }),
  });
}

function changedDeclarations(
  snapshot: Snapshot,
  table: string
): readonly Snapshot[] {
  const columns = snapshot.tables[table] ?? {};
  return [
    // Non-key declared columns are nullable; adding one must invalidate a seed.
    {
      ...snapshot,
      tables: {
        ...snapshot.tables,
        [table]: { ...columns, seed_nullable_column: 'text' },
      },
    },
    { ...snapshot, indexes: [...snapshot.indexes, [table, 'id']] },
    { ...snapshot, uniqueIndexes: [...snapshot.uniqueIndexes, [table, 'id']] },
    {
      ...snapshot,
      physicalOverrides: {
        ...snapshot.physicalOverrides,
        [table]: { id: { postgres: 'text' } },
      },
    },
  ];
}

test('every migrated framework contributes complete declarations to seed compatibility', () => {
  // regression: harness-seed-omits-framework-schema
  const composition = composeHarnessSlices('schema-inputs', []);
  const snapshots = harnessPostgresSchemas(composition.app).map((entry) =>
    entry.schema.snapshot()
  );
  const tableNames = snapshots.flatMap((snapshot) =>
    Object.keys(snapshot.tables)
  );
  for (const required of [
    'sync_engine_mutations_applied',
    'outbox_events',
    'matchmaking_waiting',
    'kv',
    'entity_store',
    'idp_users',
    'auth_users',
  ])
    expect(tableNames).toContain(required);
  const baseline = fingerprint(snapshots);
  for (const [index, snapshot] of snapshots.entries()) {
    const table = Object.keys(snapshot.tables)[0];
    if (table === undefined)
      throw new Error('A migrated registry must contain tables');
    for (const changed of changedDeclarations(snapshot, table)) {
      const next = snapshots.map((current, at) =>
        at === index ? changed : current
      );
      expect(fingerprint(next)).not.toBe(baseline);
    }
  }
});
