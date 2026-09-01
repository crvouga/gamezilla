import { describe, expect, test } from 'bun:test';
import { arbJsonValue, assertProperty, fc } from '@pkgs/pbt';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { migrateLocalSchema } from '../../client/local-schema-migrate';
import {
  sqliteWireValue,
  upsertRowsIntersect,
} from '../../client/merge-upsert';
import { acmeLocalSchema } from '../apps/acme';

function expectSqliteWire(value: unknown): void {
  const wired = sqliteWireValue(value);
  if (value === null) {
    expect(wired).toBeNull();
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    expect(wired).toBe(value);
    return;
  }
  if (typeof value === 'boolean') {
    expect(wired).toBe(value ? 1 : 0);
    return;
  }
  if (value instanceof Date) {
    expect(wired).toBe(value.toISOString());
    return;
  }
  if (typeof value === 'bigint') {
    expect(wired).toBe(value.toString());
    return;
  }
  expect(typeof wired).toBe('string');
}

describe('sqliteWireValue', () => {
  test('maps primitives and objects for SQLite binds', () => {
    assertProperty(
      'sqliteWireValue round-trips scalar shapes',
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
          fc.boolean(),
          fc.date({ noInvalidDate: true }),
          fc.bigInt({ min: -1000n, max: 1000n }),
          fc.dictionary(fc.string(), arbJsonValue(2))
        ),
        expectSqliteWire
      )
    );
  });
});

describe('upsertRowsIntersect column signatures', () => {
  test('partial rows do not bind missing keys as NULL', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    await db.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id, created_at, updated_at, deleted_at)
      VALUES (
        ${'n1'},
        ${null},
        ${'keep-title'},
        ${'seed-body'},
        ${'actor'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
      )
    `);

    const env = {
      actorId: 'actor',
      deviceId: 'device',
      accountId: 'acct',
      isAnon: false,
      now: () => new Date('2020-01-02T00:00:00.000Z'),
      createId: () => 'id-new',
    };

    await db.transaction(async (tx) => {
      await upsertRowsIntersect({
        tx,
        table: 'notes',
        rows: [{ id: 'n1', body: 'patched' }],
        localCols: [
          'id',
          'folder_id',
          'title',
          'body',
          'owner_id',
          'created_at',
          'updated_at',
          'deleted_at',
        ],
        env,
      });
    });

    const rows = await db.query(
      sql<{
        title: string;
        body: string;
      }>`SELECT title, body FROM notes WHERE id = ${'n1'}`
    );
    expect(rows[0]?.title).toBe('keep-title');
    expect(rows[0]?.body).toBe('patched');
  });
});
