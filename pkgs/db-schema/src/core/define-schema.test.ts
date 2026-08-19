import { describe, expect, test } from 'bun:test';
import { defineTable } from '../core/define-table';
import { registerTables } from '../core/register-tables';

describe('defineTable + registerTables runtime validation', () => {
  test('accepts a valid schema and deep-freezes it', () => {
    const schema = registerTables([
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { email: 'text' },
        indexes: ['email'],
        deprecations: [['name', 'prefer email']],
      }),
    ]);
    expect(Object.isFrozen(schema)).toBe(true);
    expect(Object.isFrozen(schema._declared)).toBe(true);
    expect(Object.isFrozen(schema._declared.tables)).toBe(true);
    expect(() => {
      (schema._declared.tables as { users?: unknown }).users = {};
    }).toThrow();
  });

  test('rejects non-snake_case table names with path', () => {
    expect(() =>
      defineTable({
        domain: 'users',
        name: 'UserIds',
        columns: { email: 'text' },
      })
    ).toThrow(/defineTable\(UserIds\)\.name:/);
  });

  test('rejects _-prefixed column names', () => {
    expect(() =>
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { _id: 'text' },
      })
    ).toThrow(/tables\.users\._id:/);
  });

  test('rejects declaring engine-owned managed columns', () => {
    expect(() =>
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { id: 'text' },
      })
    ).toThrow(/tables\.users\.id:.*engine-owned/);
  });

  test('rejects unique index on primary key id', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          uniqueIndexes: ['id'],
        }),
      ])
    ).toThrow(/cannot index primary key 'id'/);
  });

  test('allows index on managed created_at', () => {
    const schema = registerTables([
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { email: 'text' },
        indexes: ['created_at'],
      }),
    ]);
    expect(schema._declared.indexes).toEqual([['users', 'created_at']]);
  });

  test('rejects unknown type tokens', () => {
    expect(() =>
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { email: 'txet' as 'text' },
      })
    ).toThrow(/tables\.users\.email:/);
  });

  test('rejects index on unknown table via registerTables merge', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          indexes: [['nope'] as unknown as string],
        }),
      ])
    ).toThrow();
  });

  test('rejects index on unknown column', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          indexes: ['nope'],
        }),
      ])
    ).toThrow(/indexes\[0\]: unknown column 'nope'/);
  });

  test('rejects index on deprecated table', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
        }),
        defineTable({
          domain: 'legacy',
          name: 'legacy',
          columns: { body: 'text' },
          indexes: ['body'],
          deprecations: [['gone']],
        }),
      ])
    ).toThrow(/indexes\[0\]: table 'legacy' is deprecated/);
  });

  test('rejects duplicate indexes', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text', name: 'text' },
          indexes: ['email', 'email'],
        }),
      ])
    ).toThrow(/indexes\[1\]: duplicate index/);
  });

  test('accepts uniqueIndexes', () => {
    const schema = registerTables([
      defineTable({
        domain: 'users',
        name: 'users',
        columns: { email: 'text', slug: 'text' },
        uniqueIndexes: ['slug', 'email'],
      }),
    ]);
    expect(schema.snapshot().uniqueIndexes).toEqual([
      ['users', 'email'],
      ['users', 'slug'],
    ]);
  });

  test('rejects overlapping indexes and uniqueIndexes', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          indexes: ['email'],
          uniqueIndexes: ['email'],
        }),
      ])
    ).toThrow(/uniqueIndexes\[0\]: columns already indexed/);
  });

  test('rejects deprecation missing note (arity)', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          deprecations: [[] as unknown as readonly [string]],
        }),
      ])
    ).toThrow(/deprecations\[0\]/);
  });

  test('rejects duplicate deprecation entries', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
          deprecations: [
            ['old_name', 'a'],
            ['old_name', 'a'],
          ],
        }),
      ])
    ).toThrow(/deprecations\[1\]: duplicate/);
  });

  test('rejects column deprecation while column is still declared', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text', name: 'text' },
          deprecations: [['name', 'prefer email']],
        }),
      ])
    ).toThrow(/still declared/);
  });

  test('snapshot is deterministic', () => {
    const schema = registerTables([
      defineTable({
        domain: 'b',
        name: 'b_table',
        columns: { a_col: 'integer' },
        indexes: ['a_col'],
        deprecations: [['z_col', 'old']],
      }),
      defineTable({
        domain: 'a',
        name: 'a_table',
        columns: { m: 'text' },
        deprecations: [['retired']],
      }),
    ]);
    const a = JSON.stringify(schema.snapshot());
    const b = JSON.stringify(schema.snapshot());
    expect(a).toBe(b);
    expect(Object.keys(schema.snapshot().tables)).toEqual([
      'a_table',
      'b_table',
    ]);
    expect(Object.keys(schema.snapshot().tables['b_table']!)).toEqual([
      'a_col',
    ]);
  });

  test('domain policy accepts exact domain and domain_prefixed names', () => {
    const schema = registerTables([
      defineTable({
        domain: 'spaces',
        name: 'spaces',
        columns: { title: 'text' },
      }),
      defineTable({
        domain: 'spaces',
        name: 'spaces_users',
        columns: { space_id: 'text' },
      }),
      defineTable({
        domain: 'auth',
        name: 'auth_users',
        columns: { is_anon: 'boolean' },
      }),
    ]);
    expect(Object.keys(schema.snapshot().tables).sort()).toEqual([
      'auth_users',
      'spaces',
      'spaces_users',
    ]);
  });

  test('domain policy rejects tables outside registered domains', () => {
    expect(() =>
      defineTable({
        domain: 'friends',
        name: 'orphan_table',
        columns: { user_low: 'text' },
      })
    ).toThrow(/must equal domain 'friends' or start with 'friends_'/);
  });

  test('rejects duplicate table names across defs', () => {
    expect(() =>
      registerTables([
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { email: 'text' },
        }),
        defineTable({
          domain: 'users',
          name: 'users',
          columns: { name: 'text' },
        }),
      ])
    ).toThrow(/duplicate table 'users'/);
  });

  test('expands single-column index shorthand', () => {
    const schema = registerTables([
      defineTable({
        domain: 'auth',
        name: 'auth_devices',
        columns: { account_id: 'text', user_id: 'text' },
        indexes: ['account_id', 'user_id'],
      }),
    ]);
    expect(schema._declared.indexes).toEqual([
      ['auth_devices', 'account_id'],
      ['auth_devices', 'user_id'],
    ]);
  });

  test('supports composite index tuples', () => {
    const schema = registerTables([
      defineTable({
        domain: 'chess',
        name: 'chess_puzzles',
        columns: { rating: 'integer', popularity: 'integer' },
        indexes: [['rating', 'popularity']],
      }),
    ]);
    expect(schema._declared.indexes).toEqual([
      ['chess_puzzles', 'rating', 'popularity'],
    ]);
  });
});
