import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { createRecordingSqlClient } from '@pkgs/db-schema-root-shared-ts/fake-sql-client';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';

/** Real SQLite (bun:sqlite) behind a client that records every statement. */
function openSqlite() {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  const client = createRecordingSqlClient({
    query: <T extends Record<string, unknown>>(q: Sql<T>): Promise<T[]> =>
      Promise.resolve(
        db.query(q.sql).all(...(q.values as SQLQueryBindings[])) as T[]
      ),
    run: (q) => {
      const result = db.query(q.sql).run(...(q.values as SQLQueryBindings[]));
      return Promise.resolve({
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      });
    },
  });
  return { db, client };
}

const notesSlice = registerTables([
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: { body: 'text' },
    indexes: ['body'],
  }),
  defineTable({
    domain: 'notes',
    name: 'notes_tags',
    columns: { note_id: 'text', label: 'text' },
    uniqueIndexes: [['note_id', 'label']],
  }),
]);

const profilesSlice = registerTables([
  defineTable({
    domain: 'profiles',
    name: 'profiles',
    columns: { handle: 'text' },
  }),
]);

/** Tables another owner keeps in the same database, each with two indexes. */
function addUnrelatedTables(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    db.run(`CREATE TABLE other_${i} (id TEXT PRIMARY KEY, a TEXT, b TEXT)`);
    db.run(`CREATE INDEX other_${i}_a ON other_${i} (a)`);
    db.run(`CREATE UNIQUE INDEX other_${i}_b ON other_${i} (b)`);
  }
}

function rows(db: Database, table: string): unknown[] {
  return db.query(`SELECT * FROM "${table}" ORDER BY 1`).all();
}

function schemaSql(db: Database): unknown[] {
  return db
    .query(`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`)
    .all();
}

/** The crash state after a rebuild's `RENAME` and `CREATE` committed. */
function interruptRebuild(db: Database, table: string, ddl: string): void {
  db.run(`ALTER TABLE ${table} RENAME TO _old_${table}`);
  db.run(ddl);
}

describe('declared-only reconcile reads only what it owns', () => {
  test('steady-state work is the same with or without unrelated tables', async () => {
    // regression: sqlite-declared-only-reads-unrelated-tables
    const alone = openSqlite();
    await reconcileSqliteSchema(alone.client, notesSlice);
    alone.client.clear();
    await reconcileSqliteSchema(alone.client, notesSlice);

    const crowded = openSqlite();
    addUnrelatedTables(crowded.db, 40);
    await reconcileSqliteSchema(crowded.client, notesSlice);
    crowded.client.clear();
    await reconcileSqliteSchema(crowded.client, notesSlice);

    expect(crowded.client.calls).toEqual(alone.client.calls);
    expect(crowded.client.runCalls).toEqual([]);
  });

  test('an unrelated table whose name is not a plain identifier does not stop boot', async () => {
    // regression: sqlite-declared-only-reads-unrelated-tables
    const { db, client } = openSqlite();
    db.run(`CREATE TABLE "legacy-cache" (k TEXT PRIMARY KEY, v TEXT)`);
    db.run(`CREATE INDEX "legacy-cache by value" ON "legacy-cache" (v)`);
    db.run(`INSERT INTO "legacy-cache" VALUES ('a', 'kept')`);
    const before = schemaSql(db).filter((r) =>
      JSON.stringify(r).includes('legacy-cache')
    );

    await reconcileSqliteSchema(client, notesSlice);
    await reconcileSqliteSchema(client, notesSlice);

    expect(
      schemaSql(db).filter((r) => JSON.stringify(r).includes('legacy-cache'))
    ).toEqual(before);
    expect(rows(db, 'legacy-cache')).toEqual([{ k: 'a', v: 'kept' }]);
    expect(rows(db, 'notes')).toEqual([]);
    expect(rows(db, 'notes_tags')).toEqual([]);
  });
});

describe('staged-rebuild recovery stays inside ownership', () => {
  test('declared-only recovery leaves staging-shaped tables it does not own alone', async () => {
    // regression: sqlite-recovery-renames-unowned-staging
    const { db, client } = openSqlite();
    db.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, who TEXT)`);
    db.run(`INSERT INTO sessions VALUES ('live', 'current')`);
    db.run(`CREATE TABLE _old_sessions (id TEXT PRIMARY KEY, who TEXT)`);
    db.run(`INSERT INTO _old_sessions VALUES ('archived', 'previous')`);

    await reconcileSqliteSchema(client, notesSlice);

    expect(rows(db, 'sessions')).toEqual([{ id: 'live', who: 'current' }]);
    expect(rows(db, '_old_sessions')).toEqual([
      { id: 'archived', who: 'previous' },
    ]);
  });

  test("each slice recovers its own interrupted rebuild, not another slice's", async () => {
    // regression: sqlite-recovery-renames-unowned-staging
    const { db, client } = openSqlite();
    await reconcileSqliteSchema(client, notesSlice);
    await reconcileSqliteSchema(client, profilesSlice);
    db.run(`INSERT INTO notes (id, body) VALUES ('n1', 'milk')`);
    db.run(`INSERT INTO profiles (id, handle) VALUES ('p1', 'ada')`);
    interruptRebuild(
      db,
      'notes',
      `CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT) STRICT`
    );
    interruptRebuild(
      db,
      'profiles',
      `CREATE TABLE profiles (id TEXT PRIMARY KEY, handle TEXT) STRICT`
    );

    client.clear();
    await reconcileSqliteSchema(client, notesSlice);

    expect(rows(db, 'notes')).toMatchObject([{ id: 'n1', body: 'milk' }]);
    expect(rows(db, 'profiles')).toEqual([]);
    expect(rows(db, '_old_profiles')).toMatchObject([
      { id: 'p1', handle: 'ada' },
    ]);
    expect(client.runCalls.filter((c) => c.sql.includes('profiles'))).toEqual(
      []
    );

    await reconcileSqliteSchema(client, profilesSlice);

    expect(rows(db, 'profiles')).toMatchObject([{ id: 'p1', handle: 'ada' }]);
    expect(
      db
        .query(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '_old_*'`
        )
        .all()
    ).toEqual([]);
  });

  test('whole-db still recovers every staging table and drops undeclared ones', async () => {
    const { db, client } = openSqlite();
    await reconcileSqliteSchema(client, notesSlice);
    db.run(`INSERT INTO notes (id, body) VALUES ('n1', 'milk')`);
    interruptRebuild(
      db,
      'notes',
      `CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT) STRICT`
    );
    db.run(`CREATE TABLE scratch (id TEXT PRIMARY KEY)`);
    db.run(`CREATE TABLE _old_scratch (id TEXT PRIMARY KEY)`);
    addUnrelatedTables(db, 3);

    await reconcileSqliteSchema(client, notesSlice, { ownership: 'whole-db' });

    expect(rows(db, 'notes')).toMatchObject([{ id: 'n1', body: 'milk' }]);
    expect(
      db
        .query(
          `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
        )
        .all()
    ).toEqual([{ name: 'notes' }, { name: 'notes_tags' }]);
  });
});
