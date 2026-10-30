import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import {
  assertCompleteNewRowImages,
  IncompleteRowImageError,
} from '@pkgs/sync-engine-client-ts/merge-upsert';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

function fixture(held: readonly string[] = []) {
  const reads: Sql<unknown>[] = [];
  const db = {
    query: async (statement: Sql<unknown>) => {
      if (statement.text.startsWith('PRAGMA'))
        return ['id', 'body', 'deleted_at', 'created_at', 'updated_at'].map(
          (name) => ({ name })
        );
      reads.push(statement);
      return held.map((id) => ({ id }));
    },
  } as unknown as SqlClient;
  return { db, reads };
}

// regression: sync-complete-images-redundant-reads
// Deterministic work budgets avoid machine-speed-dependent timing thresholds.
for (const size of [1, 999, 1000, 10_000]) {
  test(`complete push images require no existence reads at ${size} rows`, async () => {
    const { db, reads } = fixture();
    const rows = Array.from({ length: size }, (_, i) => ({
      id: `note-${i}`,
      body: 'saved',
      deleted_at: null,
    }));
    await assertCompleteNewRowImages(db, 'notes', rows);
    expect(reads).toHaveLength(0);
  });
}

test('partial image reads scale with unique partial ids, not the push size', async () => {
  const { db, reads } = fixture(['held']);
  const rows: QueryRow[] = Array.from({ length: 10_000 }, (_, i) => ({
    id: `note-${i}`,
    body: 'saved',
    deleted_at: null,
  }));
  rows.push(...Array.from({ length: 2000 }, () => ({ id: 'held' })));
  await assertCompleteNewRowImages(db, 'notes', rows);
  expect(reads).toHaveLength(1);
  expect(reads[0]?.values).toEqual(['held']);
});

test('partial image lookups respect the mobile SQLite binding budget', async () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `held-${i}`);
  const { db, reads } = fixture(ids);
  await assertCompleteNewRowImages(
    db,
    'notes',
    ids.map((id) => ({ id }))
  );
  expect(reads.map((read) => read.values.length)).toEqual([999, 999, 2]);
});

test('a complete sibling does not make a missing partial image safe to insert', async () => {
  const { db } = fixture();
  await expect(
    assertCompleteNewRowImages(db, 'notes', [
      { id: 'new', body: 'saved', deleted_at: null },
      { id: 'new', deleted_at: null },
    ])
  ).rejects.toBeInstanceOf(IncompleteRowImageError);
});

test('invalid ids are ignored and held partial rows retain the existing allowance', async () => {
  const { db, reads } = fixture(['held']);
  await assertCompleteNewRowImages(db, 'notes', [
    { id: '' },
    { id: null },
    { id: 'held', body: 'changed' },
  ]);
  expect(reads).toHaveLength(1);
});
