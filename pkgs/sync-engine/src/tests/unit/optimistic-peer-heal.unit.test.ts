import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { migrateLocalSchema } from '../../client/local-schema-migrate';
import { healOptimisticPeerOrphans } from '../../client/optimistic-peer-rows';
import { acmeLocalSchema } from '../apps/acme';

describe('healOptimisticPeerOrphans', () => {
  test('snapshot ids clear markers; absent ids soft-delete', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    const nowIso = '2020-01-02T00:00:00.000Z';

    await db.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id, created_at, updated_at, deleted_at)
      VALUES (
        ${'live'},
        ${null},
        ${''},
        ${'live'},
        ${'actor'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);
    await db.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id, created_at, updated_at, deleted_at)
      VALUES (
        ${'orphan'},
        ${null},
        ${''},
        ${'orphan'},
        ${'actor'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);
    await db.run(sql`
      INSERT INTO sync_engine_optimistic_peer_rows (
        id, table_name, row_id, created_at, updated_at, deleted_at
      )
      VALUES
        (${'notes:live'}, ${'notes'}, ${'live'}, ${'2020-01-01T00:00:00.000Z'}, ${'2020-01-01T00:00:00.000Z'}, ${null}),
        (${'notes:orphan'}, ${'notes'}, ${'orphan'}, ${'2020-01-01T00:00:00.000Z'}, ${'2020-01-01T00:00:00.000Z'}, ${null})
    `);

    await db.transaction(async (tx) => {
      await healOptimisticPeerOrphans(
        tx,
        {
          notes: [
            {
              id: 'live',
              folder_id: null,
              title: '',
              body: 'live',
              owner_id: 'actor',
              created_at: '2020-01-01T00:00:00.000Z',
              updated_at: '2020-01-01T00:00:00.000Z',
              deleted_at: null,
            },
          ],
        },
        nowIso
      );
    });

    const markers = await db.query(sql<{ c: number | string }>`
      SELECT COUNT(*) AS c FROM sync_engine_optimistic_peer_rows
      WHERE deleted_at IS NULL
    `);
    expect(Number(markers[0]?.c ?? 0)).toBe(0);

    const orphan = await db.query(sql<{ deleted_at: string | null }>`
      SELECT deleted_at FROM notes WHERE id = ${'orphan'}
    `);
    expect(orphan[0]?.deleted_at).toBe(nowIso);

    const live = await db.query(sql<{ deleted_at: string | null }>`
      SELECT deleted_at FROM notes WHERE id = ${'live'}
    `);
    expect(live[0]?.deleted_at).toBeNull();
  });

  test('leaves own rows whose mutation is still queued', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    const nowIso = '2020-01-02T00:00:00.000Z';

    await db.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id, created_at, updated_at, deleted_at)
      VALUES (
        ${'pending-own'},
        ${null},
        ${''},
        ${'mine'},
        ${'actor'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);
    await db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq, created_at, updated_at, deleted_at
      )
      VALUES (
        ${'mut-1'},
        ${'setNote'},
        ${'{}'},
        ${'device:actor'},
        ${1},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);
    await db.run(sql`
      INSERT INTO sync_engine_optimistic_peer_rows (
        id, table_name, row_id, mutation_id, created_at, updated_at, deleted_at
      )
      VALUES (
        ${'notes:pending-own'},
        ${'notes'},
        ${'pending-own'},
        ${'mut-1'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);

    await db.transaction(async (tx) => {
      await healOptimisticPeerOrphans(tx, { notes: [] }, nowIso);
    });

    const note = await db.query(sql<{ deleted_at: string | null }>`
      SELECT deleted_at FROM notes WHERE id = ${'pending-own'}
    `);
    expect(note[0]?.deleted_at).toBeNull();

    const markers = await db.query(sql<{ c: number | string }>`
      SELECT COUNT(*) AS c FROM sync_engine_optimistic_peer_rows
      WHERE deleted_at IS NULL
    `);
    expect(Number(markers[0]?.c ?? 0)).toBe(1);
  });

  test('skips work when marker table is empty', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    const changed = await db.transaction(async (tx) =>
      healOptimisticPeerOrphans(tx, { notes: [] }, '2020-01-02T00:00:00.000Z')
    );
    expect(changed).toEqual([]);
  });
});
