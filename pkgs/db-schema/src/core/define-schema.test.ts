import { describe, expect, test } from 'bun:test';
import { defineSchema } from '../core/define-schema';

describe('defineSchema runtime validation', () => {
  test('accepts a valid schema and deep-freezes it', () => {
    const schema = defineSchema({
      tables: {
        users: { email: 'text', name: 'text' },
      },
      indexes: [['users', 'email']],
      deprecations: [['users', 'name', 'prefer email']],
    });
    expect(Object.isFrozen(schema)).toBe(true);
    expect(Object.isFrozen(schema._declared)).toBe(true);
    expect(Object.isFrozen(schema._declared.tables)).toBe(true);
    expect(() => {
      (schema._declared.tables as { users?: unknown }).users = {};
    }).toThrow();
  });

  test('rejects non-snake_case table names with path', () => {
    expect(() =>
      defineSchema({
        tables: {
          UserIds: { email: 'text' },
        },
      } as never)
    ).toThrow(/tables\.UserIds:/);
  });

  test('rejects _-prefixed column names', () => {
    expect(() =>
      defineSchema({
        tables: {
          users: {
            _id: 'text',
          },
        },
      } as never)
    ).toThrow(/tables\.users\._id:/);
  });

  test('rejects declaring engine-owned managed columns', () => {
    expect(() =>
      defineSchema({
        tables: {
          users: {
            id: 'text',
          },
        },
      } as never)
    ).toThrow(/tables\.users\.id:.*engine-owned/);
  });

  test('rejects unique index on primary key id', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        uniqueIndexes: [['users', 'id']],
      } as never)
    ).toThrow(/cannot index primary key 'id'/);
  });

  test('allows index on managed created_at', () => {
    const schema = defineSchema({
      tables: { users: { email: 'text' } },
      indexes: [['users', 'created_at']],
    });
    expect(schema._declared.indexes).toEqual([['users', 'created_at']]);
  });

  test('rejects unknown type tokens', () => {
    expect(() =>
      defineSchema({
        tables: {
          users: {
            email: 'txet',
          },
        },
      } as never)
    ).toThrow(/tables\.users\.email:/);
  });

  test('rejects unknown top-level keys', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        views: [],
      } as never)
    ).toThrow(/unknown top-level key 'views'/);
  });

  test('rejects index on unknown table', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        indexes: [['nope', 'email']],
      } as never)
    ).toThrow(/indexes\[0\]: unknown table 'nope'/);
  });

  test('rejects index on unknown column', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        indexes: [['users', 'nope']],
      } as never)
    ).toThrow(/indexes\[0\]: unknown column 'nope'/);
  });

  test('rejects index on deprecated table', () => {
    expect(() =>
      defineSchema({
        tables: {
          users: { email: 'text' },
          legacy: { body: 'text' },
        },
        indexes: [['legacy', 'body']],
        deprecations: [['legacy', 'gone']],
      } as never)
    ).toThrow(/indexes\[0\]: table 'legacy' is deprecated/);
  });

  test('rejects duplicate indexes', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text', name: 'text' } },
        indexes: [
          ['users', 'email'],
          ['users', 'email'],
        ],
      })
    ).toThrow(/indexes\[1\]: duplicate index/);
  });

  test('accepts uniqueIndexes', () => {
    const schema = defineSchema({
      tables: { users: { email: 'text', slug: 'text' } },
      uniqueIndexes: [
        ['users', 'slug'],
        ['users', 'email'],
      ],
    });
    expect(schema.snapshot().uniqueIndexes).toEqual([
      ['users', 'email'],
      ['users', 'slug'],
    ]);
  });

  test('rejects overlapping indexes and uniqueIndexes', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        indexes: [['users', 'email']],
        uniqueIndexes: [['users', 'email']],
      })
    ).toThrow(/uniqueIndexes\[0\]: columns already indexed/);
  });

  test('rejects deprecation missing note (arity)', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        deprecations: [['users'] as never],
      })
    ).toThrow(/deprecations\[0\]/);
  });

  test('rejects duplicate deprecation entries', () => {
    expect(() =>
      defineSchema({
        tables: { users: { email: 'text' } },
        deprecations: [
          ['users', 'email', 'a'],
          ['users', 'email', 'a'],
        ],
      })
    ).toThrow(/deprecations\[1\]: duplicate/);
  });

  test('snapshot is deterministic', () => {
    const schema = defineSchema({
      tables: {
        b_table: { z_col: 'text', a_col: 'integer' },
        a_table: { m: 'text', old: 'text' },
      },
      indexes: [
        ['b_table', 'a_col'],
        ['a_table', 'm'],
      ],
      deprecations: [
        ['b_table', 'z_col', 'old'],
        ['a_table', 'old', 'retired'],
      ],
    });
    const a = JSON.stringify(schema.snapshot());
    const b = JSON.stringify(schema.snapshot());
    expect(a).toBe(b);
    expect(Object.keys(schema.snapshot().tables)).toEqual([
      'a_table',
      'b_table',
    ]);
    expect(Object.keys(schema.snapshot().tables['b_table']!)).toEqual([
      'a_col',
      'z_col',
    ]);
  });
});
