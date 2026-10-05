import { expect, test } from 'bun:test';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes-root-shared/parse-node-sql';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const dialect = fc.constantFrom('PostgreSQL' as const, 'Sqlite' as const);
const aliases = fc.tuple(
  fc.constantFrom('a', 'left_side'),
  fc.constantFrom('b', 'right_side')
);

test('joined filters, projections, ordering and partial predicates stay on their tables', () => {
  assertProperty(
    'join column ownership',
    fc.property(
      dialect,
      aliases,
      fc.boolean(),
      (dbDialect, [a, b], reverse) => {
        const from = reverse
          ? `devices ${b} JOIN notes ${a}`
          : `notes ${a} JOIN devices ${b}`;
        const parsed = parseWithNodeSqlParser(
          `
      SELECT ${a}.title, ${b}.label FROM ${from}
      ON ${a}.owner_id = ${b}.user_id
      WHERE ${b}.device_id = ? AND ${a}.created_at > ? AND ${a}.deleted_at IS NULL
      ORDER BY ${b}.label, ${a}.title
    `,
          dbDialect
        );
        expect(parsed.ok).toBe(true);
        expect(parsed.paths.find((path) => path.table === 'notes')).toEqual({
          table: 'notes',
          equality: ['owner_id'],
          range: ['created_at'],
          orderBy: ['title'],
          selectList: ['title'],
          partialPredicate: 'deleted_at IS NULL',
        });
        expect(parsed.paths.find((path) => path.table === 'devices')).toEqual({
          table: 'devices',
          equality: ['device_id', 'user_id'],
          range: [],
          orderBy: ['label'],
          selectList: ['label'],
          partialPredicate: null,
        });
      }
    )
  );
});

test('correlated subqueries keep outer columns out of the inner access path', () => {
  assertProperty(
    'subquery column ownership',
    fc.property(dialect, aliases, (dbDialect, [a, b]) => {
      const parsed = parseWithNodeSqlParser(
        `
      SELECT ${a}.title FROM notes ${a} WHERE ${a}.owner_id IN (
        SELECT ${b}.user_id FROM devices ${b}
        WHERE ${b}.device_id = ? AND ${b}.user_id = ${a}.owner_id
      )
    `,
        dbDialect
      );
      expect(parsed.ok).toBe(true);
      expect(parsed.paths.map((path) => [path.table, path.equality])).toEqual([
        ['notes', ['owner_id']],
        ['devices', ['device_id', 'user_id']],
      ]);
    })
  );
});

test('self joins keep separate access paths for each alias', () => {
  assertProperty(
    'self join column ownership',
    fc.property(dialect, aliases, (dbDialect, [a, b]) => {
      const parsed = parseWithNodeSqlParser(
        `
      SELECT ${a}.*, ${b}.title FROM notes ${a} JOIN notes ${b}
      ON ${a}.parent_id = ${b}.id WHERE ${a}.owner_id = ?
    `,
        dbDialect
      );
      expect(parsed.ok).toBe(true);
      expect(
        parsed.paths.map((path) => [path.equality, path.selectList])
      ).toEqual([
        [['owner_id', 'parent_id'], ['*']],
        [['id'], ['title']],
      ]);
    })
  );
});
