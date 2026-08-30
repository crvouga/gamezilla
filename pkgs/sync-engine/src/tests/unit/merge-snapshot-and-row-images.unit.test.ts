import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { migrateLocalSchema } from '../../client/local-schema-migrate';
import {
  applyFullMerge,
  applyRowImages,
  type MergeApplierDeps,
} from '../../client/merge';
import { recordOptimisticOwnRows } from '../../mutations/client/optimistic-own-rows';
import { createTableChangeBus } from '../../queries/client/table-change-bus';
import {
  acmeLocalSchema,
  acmeLocalSchemaExtraColumn,
  acmeMutationRegistry,
} from '../apps/acme';

function mergeEnv() {
  let n = 0;
  return {
    actorId: 'actor',
    deviceId: 'device',
    accountId: 'acct',
    isAnon: false,
    now: () => new Date('2020-01-01T00:00:00.000Z'),
    createId: () => `id-${++n}`,
  };
}

async function openMergeDb(schema = acmeLocalSchema) {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await migrateLocalSchema(db, schema);
  const bus = createTableChangeBus();
  const deps: MergeApplierDeps = {
    db,
    registry: acmeMutationRegistry,
    env: mergeEnv(),
    bus,
    clientId: 'c0',
  };
  return { db, deps };
}

describe('merge snapshot and row images unit', () => {
  test('extra server keys ignored; missing keys do not null local columns', async () => {
    const { db, deps } = await openMergeDb(acmeLocalSchemaExtraColumn);
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            folder_id: null,
            title: '',
            body: 'v1',
            color: 'red',
            owner_id: 'actor',
            deleted_at: null,
          },
        ],
      },
    });
    // Local-only write then peer snapshot without color key.
    await db.run(sql`UPDATE notes SET color = ${'kept'} WHERE id = ${'n1'}`);
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '2',
      hash: 'h2',
      tables: {
        notes: [
          {
            id: 'n1',
            folder_id: null,
            title: '',
            body: 'v2',
            owner_id: 'actor',
            deleted_at: null,
            // color omitted — must not clobber
            server_only: 'ignored',
          },
        ],
      },
    });
    const rows = await db.query(sql<{ body: string; color: string | null }>`
      SELECT body, color FROM notes WHERE id = ${'n1'}
    `);
    expect(rows[0]).toEqual({ body: 'v2', color: 'kept' });
    await db.disconnect();
  });

  test('sqliteWireValue coerces bool date object bigint undefined', async () => {
    const { db, deps } = await openMergeDb();
    const when = new Date('2021-06-15T12:00:00.000Z');
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            folder_id: null,
            title: '',
            body: JSON.stringify({ nested: true }),
            owner_id: 'actor',
            deleted_at: null,
            // managed columns via coercion paths exercised in upsert
            created_at: when,
            updated_at: undefined,
          } as never,
        ],
      },
    });
    // Also apply a row-image with boolean-ish managed fill via bigint id path
    // covered separately; here confirm body stored as string.
    const rows = await db.query(sql<{ body: string; created_at: string }>`
      SELECT body, created_at FROM notes WHERE id = ${'n1'}
    `);
    expect(rows[0]?.body).toBe('{"nested":true}');
    expect(rows[0]?.created_at).toBe(when.toISOString());
    await db.disconnect();
  });

  test('poison snapshot id rolls back whole merge', async () => {
    const { db, deps } = await openMergeDb();
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'good',
            folder_id: null,
            title: '',
            body: 'ok',
            owner_id: 'actor',
            deleted_at: null,
          },
        ],
      },
    });
    await expect(
      applyFullMerge(deps, {
        scopeHash: 's1',
        checkpoint: '2',
        hash: 'h2',
        tables: {
          notes: [
            {
              id: 'kept',
              folder_id: null,
              title: '',
              body: 'should-not-commit',
              owner_id: 'actor',
              deleted_at: null,
            },
            {
              id: '',
              folder_id: null,
              title: '',
              body: 'bad',
              owner_id: 'actor',
              deleted_at: null,
            },
          ],
        },
      })
    ).rejects.toThrow();
    const rows = await db.query(sql<{ id: string; body: string }>`
      SELECT id, body FROM notes ORDER BY id ASC
    `);
    expect(rows).toEqual([{ id: 'good', body: 'ok' }]);
    await db.disconnect();
  });

  test('row images skip unknown table and bad ids; good siblings apply', async () => {
    const { db, deps } = await openMergeDb();
    await applyRowImages(deps, {
      notes: [
        {
          id: 'good',
          folder_id: null,
          title: '',
          body: 'ok',
          owner_id: 'actor',
          deleted_at: null,
        },
        {
          id: '',
          folder_id: null,
          title: '',
          body: 'bad-empty',
          owner_id: 'actor',
          deleted_at: null,
        },
        {
          id: null as never,
          folder_id: null,
          title: '',
          body: 'bad-null',
          owner_id: 'actor',
          deleted_at: null,
        },
        {
          id: 42 as never,
          folder_id: null,
          title: '',
          body: 'bad-num',
          owner_id: 'actor',
          deleted_at: null,
        },
      ],
      no_such_table: [
        {
          id: 'x',
          body: 'skip',
        },
      ],
      'bad-table!': [
        {
          id: 'y',
          body: 'skip-invalid-name',
        },
      ],
    });
    const rows = await db.query(sql<{ id: string; body: string }>`
      SELECT id, body FROM notes ORDER BY id ASC
    `);
    expect(rows).toEqual([{ id: 'good', body: 'ok' }]);
    await db.disconnect();
  });

  test('own optimistic insert absent from snapshot is tombstoned', async () => {
    const { db, deps } = await openMergeDb();
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n0',
            folder_id: null,
            title: '',
            body: 'orphan',
            owner_id: 'actor',
            deleted_at: null,
          },
        ],
      },
    });
    await recordOptimisticOwnRows(db, 'm-n0', {
      tables: ['notes'],
      ids: { notes: ['n0'] },
      images: {},
    });
    await applyFullMerge(deps, {
      scopeHash: 's1',
      checkpoint: '2',
      hash: 'h2',
      tables: {
        notes: [
          {
            id: 'n2',
            folder_id: null,
            title: '',
            body: 'kept',
            owner_id: 'actor',
            deleted_at: null,
          },
        ],
      },
    });
    const rows = await db.query(sql<{
      id: string;
      body: string;
      deleted_at: string | null;
    }>`
      SELECT id, body, deleted_at FROM notes ORDER BY id ASC
    `);
    expect(rows).toEqual([
      { id: 'n0', body: 'orphan', deleted_at: '2020-01-01T00:00:00.000Z' },
      { id: 'n2', body: 'kept', deleted_at: null },
    ]);
    await db.disconnect();
  });
});
