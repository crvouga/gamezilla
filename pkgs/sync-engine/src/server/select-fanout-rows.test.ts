import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { sql, unsafe } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { MAX_FANOUT_BYTES, MAX_FANOUT_ROWS } from '../queries/shared/bounds';
import {
  fanoutRowsWithinCap,
  mergeAffectedRows,
  selectFanoutRows,
} from './select-fanout-rows';

describe('selectFanoutRows', () => {
  async function openDb() {
    const raw = new Database(':memory:');
    const db = new SqlClientImplBunSqlite(raw);
    await db.connect();
    await db.run(
      unsafe(`
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        _deleted_at TEXT
      )
    `)
    );
    return db;
  }

  test('SELECT includes _deleted_at and does not live-filter', async () => {
    const db = await openDb();
    await db.run(sql`
      INSERT INTO notes (id, body, _deleted_at)
      VALUES ('n1', 'live', NULL), ('n2', 'gone', '2020-01-01T00:00:00.000Z')
    `);
    const rows = await selectFanoutRows(db, { notes: ['n1', 'n2'] });
    expect(rows['notes']?.length).toBe(2);
    const tomb = rows['notes']?.find((r) => r['id'] === 'n2');
    expect(tomb?.['_deleted_at']).toBe('2020-01-01T00:00:00.000Z');
  });

  test('undeclared / empty affected yields empty', async () => {
    const db = await openDb();
    const rows = await selectFanoutRows(db, {});
    expect(rows).toEqual({});
  });

  test('mergeAffectedRows unions ids per table', () => {
    expect(
      mergeAffectedRows([
        { notes: ['a', 'b'] },
        { notes: ['b', 'c'], rooms: ['r1'] },
      ])
    ).toEqual({ notes: ['a', 'b', 'c'], rooms: ['r1'] });
  });

  test('size cap at exactly MAX_FANOUT_ROWS', () => {
    const notes = Array.from({ length: MAX_FANOUT_ROWS }, (_, i) => ({
      id: `n${i}`,
    }));
    const exact: Record<string, Array<{ id: string }>> = { notes };
    expect(fanoutRowsWithinCap(exact)).toBe(true);
    notes.push({ id: 'overflow' });
    expect(fanoutRowsWithinCap(exact)).toBe(false);
  });

  test('size cap at exactly MAX_FANOUT_BYTES', () => {
    // One oversized string column pushes past the byte cap.
    const fat = {
      notes: [
        {
          id: 'n1',
          body: 'x'.repeat(MAX_FANOUT_BYTES),
        },
      ],
    };
    expect(fanoutRowsWithinCap(fat)).toBe(false);
    expect(fanoutRowsWithinCap({ notes: [{ id: 'n1', body: 'ok' }] })).toBe(
      true
    );
  });
});
