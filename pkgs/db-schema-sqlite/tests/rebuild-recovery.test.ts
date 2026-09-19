import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { planClient } from '@pkgs/db-schema/core/plan';
import { createRecordingSqlClient } from '@pkgs/db-schema/test/fake-sql-client';
import { raw } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { readSqliteCatalog } from '../src/catalog';
import { sqlite } from '../src/driver';
import { emitClientOperation } from '../src/emit';

function notesSchema(
  columns: Record<string, 'text'>,
  retiredColumns?: readonly { name: string; type: 'text'; note: string }[]
) {
  return registerTables([
    defineTable({
      domain: 'notes',
      name: 'notes',
      columns,
      ...(retiredColumns === undefined ? {} : { retiredColumns }),
    }),
  ]);
}

describe('sqlite rebuild recovery', () => {
  test('recovers every interrupted rebuild stage without losing rows', async () => {
    const v1 = notesSchema({ body: 'text', old_field: 'text' });
    const v2 = notesSchema({ body: 'text' }, [
      { name: 'old_field', type: 'text', note: 'no longer used' },
    ]);

    // The emitted rebuild has rename, create, copy, and drop stages. Stop
    // immediately after each prefix (except the completed prefix) to model a
    // process crash after that statement committed.
    const probeDb = new Database(':memory:');
    const probeClient = new SqlClientImplBunSqlite(probeDb);
    await sqlite(v1, probeClient).reconcile();
    const probeCatalog = await readSqliteCatalog(probeClient);
    const probePlan = planClient(v2._declared, probeCatalog, {
      ownership: 'declared-only',
    });
    if (!probePlan.ok) throw new Error('expected rebuild plan');
    const probeOp = probePlan.operations.find(
      (op) => op.kind === 'rebuild_table'
    );
    if (probeOp === undefined || probeOp.kind !== 'rebuild_table') {
      throw new Error('expected rebuild_table operation');
    }
    const statementCount = emitClientOperation(probeOp, v2._declared).length;
    expect(statementCount).toBeGreaterThanOrEqual(3);

    for (let stoppedAfter = 1; stoppedAfter < statementCount; stoppedAfter++) {
      const db = new Database(':memory:');
      const client = new SqlClientImplBunSqlite(db);
      await sqlite(v1, client).reconcile();
      await client.run(
        raw(
          `INSERT INTO notes (id, body, old_field) VALUES ('one', 'body-1', 'old-1'), ('two', 'body-2', 'old-2')`
        )
      );

      const catalog = await readSqliteCatalog(client);
      const plan = planClient(v2._declared, catalog, {
        ownership: 'declared-only',
      });
      if (!plan.ok) throw new Error('expected rebuild plan');
      const op = plan.operations.find(
        (candidate) => candidate.kind === 'rebuild_table'
      );
      if (op === undefined || op.kind !== 'rebuild_table') {
        throw new Error('expected rebuild_table operation');
      }
      const statements = emitClientOperation(op, v2._declared);
      for (let i = 0; i < stoppedAfter; i++) {
        await client.run(statements[i]!);
      }

      await expect(sqlite(v2, client).reconcile()).resolves.toBeUndefined();
      const rows = await client.query<{ id: string; body: string }>(
        raw(`SELECT id, body FROM notes ORDER BY id`)
      );
      expect(rows).toEqual([
        { id: 'one', body: 'body-1' },
        { id: 'two', body: 'body-2' },
      ]);
      const staging = await client.query<{ name: string }>(
        raw(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '_old_*'`
        )
      );
      expect(staging).toEqual([]);

      const recording = createRecordingSqlClient(client);
      await sqlite(v2, recording).reconcile();
      expect(recording.runCalls.length).toBe(0);
    }
  });

  test('recovers an interrupted rebuild with foreign_keys ON', async () => {
    const v1 = notesSchema({ body: 'text', old_field: 'text' });
    const v2 = notesSchema({ body: 'text' }, [
      { name: 'old_field', type: 'text', note: 'no longer used' },
    ]);

    const db = new Database(':memory:');
    const client = new SqlClientImplBunSqlite(db);
    await sqlite(v1, client).reconcile();
    // A host table referencing notes, exactly as an existing database has it.
    await client.run(
      raw(
        `CREATE TABLE legacy_notes (id TEXT PRIMARY KEY, note_id TEXT REFERENCES notes (id)) STRICT`
      )
    );
    await client.run(
      raw(
        `INSERT INTO notes (id, body, old_field) VALUES ('n1', 'body', 'old')`
      )
    );
    await client.run(
      raw(`INSERT INTO legacy_notes (id, note_id) VALUES ('l1', 'n1')`)
    );

    // Reach the crash state: the staging rename, new create, and copy all
    // committed, so `_old_notes` holds the pre-rebuild rows.
    const catalog = await readSqliteCatalog(client);
    const plan = planClient(v2._declared, catalog, {
      ownership: 'declared-only',
    });
    if (!plan.ok) throw new Error('expected rebuild plan');
    const op = plan.operations.find(
      (candidate) => candidate.kind === 'rebuild_table'
    );
    if (op === undefined || op.kind !== 'rebuild_table') {
      throw new Error('expected rebuild_table operation');
    }
    const statements = emitClientOperation(op, v2._declared);
    for (const statement of statements.slice(0, 3)) {
      await client.run(statement);
    }

    // Real client connections run with foreign_keys ON.
    await client.run(raw('PRAGMA foreign_keys = ON'));
    await expect(sqlite(v2, client).reconcile()).resolves.toBeUndefined();

    const rows = await client.query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM notes ORDER BY id`)
    );
    expect(rows).toEqual([{ id: 'n1', body: 'body' }]);
    const staging = await client.query<{ name: string }>(
      raw(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '_old_*'`
      )
    );
    expect(staging).toEqual([]);
    const foreignKeys = await client.query<{
      table: string;
      from: string;
      to: string;
    }>(raw(`PRAGMA foreign_key_list(legacy_notes)`));
    expect(
      foreignKeys.map(({ table, from, to }) => ({ table, from, to }))
    ).toEqual([{ table: 'notes', from: 'note_id', to: 'id' }]);
  });
});
