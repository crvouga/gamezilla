import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { classify, hasReturningClause } from '../../sql-ast';

/** Spaces-shaped statement corpus — classify + RETURNING inject gate. */
const CORPUS: readonly {
  readonly name: string;
  readonly query: ReturnType<typeof sql>;
  readonly expect: {
    readonly kind: 'write' | 'read' | 'delete';
    readonly table?: string;
    readonly op?: 'insert' | 'upsert' | 'update';
    readonly softDelete?: boolean;
  };
}[] = [
  {
    name: 'spaces upsert ON CONFLICT',
    query: sql`
      INSERT INTO spaces (id, title, owner_id)
      VALUES (NULL, NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET title = excluded.title
    `,
    expect: { kind: 'write', table: 'spaces', op: 'upsert' },
  },
  {
    name: 'space_users upsert',
    query: sql`
      INSERT INTO space_users (id, space_id, user_id)
      VALUES (NULL, NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id
    `,
    expect: { kind: 'write', table: 'space_users', op: 'upsert' },
  },
  {
    name: 'space_open_sessions upsert',
    query: sql`
      INSERT INTO space_open_sessions (id, space_id, device_id)
      VALUES (NULL, NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET space_id = excluded.space_id
    `,
    expect: { kind: 'write', table: 'space_open_sessions', op: 'upsert' },
  },
  {
    name: 'spaces update host',
    query: sql`UPDATE spaces SET host_member_id = NULL WHERE id = NULL`,
    expect: { kind: 'write', table: 'spaces', op: 'update', softDelete: false },
  },
  {
    name: 'space_users soft-delete',
    query: sql`
      UPDATE space_users SET _deleted_at = NULL
      WHERE id = NULL AND _deleted_at IS NULL
    `,
    expect: {
      kind: 'write',
      table: 'space_users',
      op: 'update',
      softDelete: true,
    },
  },
  {
    name: 'space_open_sessions soft-delete by id',
    query: sql`
      UPDATE space_open_sessions SET _deleted_at = NULL WHERE id = NULL
    `,
    expect: {
      kind: 'write',
      table: 'space_open_sessions',
      op: 'update',
      softDelete: true,
    },
  },
  {
    name: 'space_open_sessions soft-delete by space_id',
    query: sql`
      UPDATE space_open_sessions SET _deleted_at = NULL WHERE space_id = NULL
    `,
    expect: {
      kind: 'write',
      table: 'space_open_sessions',
      op: 'update',
      softDelete: true,
    },
  },
  {
    name: 'sessions close via subquery',
    query: sql`
      UPDATE space_open_sessions SET _deleted_at = NULL
      WHERE space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
    `,
    expect: {
      kind: 'write',
      table: 'space_open_sessions',
      op: 'update',
      softDelete: true,
    },
  },
  {
    name: 'membership select with CTE',
    query: sql`
      WITH related_spaces AS (
        SELECT id FROM spaces WHERE host_member_id = NULL
      )
      SELECT id, space_id, user_id, _deleted_at FROM space_users
      WHERE space_id IN (SELECT id FROM related_spaces)
    `,
    expect: { kind: 'read' },
  },
  {
    name: 'hard delete forbidden classify',
    query: sql`DELETE FROM notes WHERE id = NULL`,
    expect: { kind: 'delete', table: 'notes' },
  },
];

describe('AST capture + RETURNING corpus', () => {
  for (const item of CORPUS) {
    test(`${item.name} classifies`, () => {
      const { query, expect: exp } = item;
      const classified = classify(query, 'postgresql');
      expect(classified.kind).toBe(exp.kind);
      if (exp.kind === 'write') {
        expect(classified).toMatchObject({
          kind: 'write',
          table: exp.table,
          op: exp.op,
          ...(exp.softDelete !== undefined
            ? { softDelete: exp.softDelete }
            : {}),
        });
        expect(hasReturningClause(query)).toBe(false);
        const withRet = sql`${query} RETURNING *`;
        expect(hasReturningClause(withRet)).toBe(true);
        expect(classify(withRet).kind).toBe('write');
      }
      if (exp.kind === 'delete') {
        expect(classified).toMatchObject({
          kind: 'delete',
          table: exp.table,
        });
      }
      if (exp.kind === 'read') {
        expect(classified.kind).toBe('read');
        if (classified.kind === 'read') {
          expect(classified.tables).toContain('space_users');
          expect(classified.hasDeletedAtColumn).toBe(true);
          expect(classified.hasDeletedAtPredicate).toBe(false);
        }
      }
    });
  }

  test('sqlite dialect parse path still classifies via postgresql', () => {
    const query = sql`
      INSERT INTO notes (id, body) VALUES (NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET body = excluded.body
    `;
    const pg = classify(query, 'postgresql');
    const sqlite = classify(query, 'sqlite');
    expect(pg).toEqual(sqlite);
    expect(pg).toMatchObject({
      kind: 'write',
      table: 'notes',
      op: 'upsert',
    });
  });

  test('reserved column name at classifies as write/read', () => {
    const insert = sql`
      INSERT INTO chess_puzzle_interactions (
        id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, uci, correct,
        rating_before, rating_after, at
      )
      VALUES (
        ${'i'}, ${'o'}, ${'p'}, ${1}, ${'k'}, ${0}, ${null}, ${null},
        ${0}, ${0}, ${'t'}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    expect(classify(insert)).toMatchObject({
      kind: 'write',
      table: 'chess_puzzle_interactions',
      op: 'upsert',
    });
    const select = sql`
      SELECT id, at, _deleted_at FROM chess_puzzle_interactions
      WHERE owner_id = ${'o'}
    `;
    expect(classify(select)).toMatchObject({
      kind: 'read',
      hasDeletedAtColumn: true,
    });
  });
});
