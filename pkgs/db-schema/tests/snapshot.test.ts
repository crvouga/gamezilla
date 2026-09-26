import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';

describe('Schema.snapshot() projection', () => {
  test('is deterministic — the same schema serializes byte-identically', () => {
    const build = () =>
      registerTables(
        [
          defineTable({
            domain: 'alpha',
            name: 'alpha',
            columns: { z: 'text', a: 'integer' },
            uniqueIndexes: ['a'],
          }),
          defineTable({
            domain: 'gamma',
            name: 'gamma',
            columns: { b: 'json' },
            retiredColumns: [
              { name: 'legacy', type: 'json', note: 'old clients read legacy' },
            ],
          }),
        ],
        {
          retiredTables: [
            { domain: 'gone', name: 'gone', note: 'old clients read gone' },
          ],
        }
      );

    const first = JSON.stringify(build().snapshot());
    const second = JSON.stringify(build().snapshot());
    expect(first).toBe(second);
  });

  test('table and column keys are sorted', () => {
    const snapshot = registerTables([
      defineTable({
        domain: 'gamma',
        name: 'gamma',
        columns: { z: 'text', a: 'text' },
      }),
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { m: 'text', b: 'text' },
      }),
    ]).snapshot();

    expect(Object.keys(snapshot.tables)).toEqual(['alpha', 'gamma']);
    expect(Object.keys(snapshot.tables['alpha']!)).toEqual(['b', 'm']);
    expect(Object.keys(snapshot.tables['gamma']!)).toEqual(['a', 'z']);
  });

  test('retiredColumns and retiredTables project type and note', () => {
    const snapshot = registerTables(
      [
        defineTable({
          domain: 'alpha',
          name: 'alpha',
          columns: { a: 'text' },
          retiredColumns: [
            { name: 'legacy', type: 'json', note: 'old clients read legacy' },
            { name: 'older', type: 'integer', note: 'older clients' },
          ],
        }),
      ],
      {
        retiredTables: [
          { domain: 'gone', name: 'gone', note: 'old clients read gone' },
          { domain: 'alpha_old', name: 'alpha_old', note: 'older clients' },
        ],
      }
    ).snapshot();

    expect(snapshot.retiredColumns).toEqual({
      alpha: {
        legacy: { type: 'json', note: 'old clients read legacy' },
        older: { type: 'integer', note: 'older clients' },
      },
    });
    expect(snapshot.retiredTables).toEqual([
      { name: 'alpha_old', note: 'older clients' },
      { name: 'gone', note: 'old clients read gone' },
    ]);
  });

  test('physicalOverrides carry engine overrides and omit plain columns', () => {
    const snapshot = registerTables([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: {
          a: { type: 'text', postgres: 'varchar' },
          b: { type: 'text', sqlite: 'blob' },
          c: 'text',
        },
      }),
    ]).snapshot();

    expect(snapshot.physicalOverrides).toEqual({
      alpha: {
        a: { postgres: 'varchar' },
        b: { sqlite: 'BLOB' },
      },
    });

    const plain = registerTables([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { c: 'text' } }),
    ]).snapshot();
    expect(plain.physicalOverrides).toEqual({});
  });

  test('a schema without tombstones projects empty retired collections', () => {
    const snapshot = registerTables([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]).snapshot();

    expect(snapshot.retiredColumns).toEqual({});
    expect(snapshot.retiredTables).toEqual([]);
  });
});
