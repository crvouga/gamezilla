import { assert } from '@pkgs/assert';
import { asKeyword } from '@pkgs/keyword';
import { questionMarkParamsToDollarParams } from '@pkgs/sql-client/positional-params';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createEntitySchemaRegistry, defineEntitySchema } from '../schema';
import { QGameSession, QTask } from '../test/query-test-attrs';
import { buildPartitionLayout } from './partitioning';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
  buildWhereClause,
  MAX_SUBQUERY_DEPTH,
  type PgQueryBuilderOptions,
} from './query-builder-pg';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

function toPgSql(clause: Parameters<typeof buildWhereClause>[0]): string {
  const { sql, params } = buildWhereClause(clause);
  const [pgSql] = questionMarkParamsToDollarParams(sql, params);
  return pgSql;
}

describe('buildWhereClause with namespaced attributes', () => {
  test('= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: QTask.title.key,
      value: 'hello',
    });
    expect(sql).toContain('->>');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('task/title');
    expect(params[1]).toBe('hello');
  });

  test('!= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '!=',
      attribute: QTask.done.key,
      value: true,
    });
    expect(sql).toContain('IS DISTINCT FROM ?::text');
    expect(params[0]).toBe('task/done');
    expect(params[1]).toBe('true');
  });

  test('in clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open', 'closed'],
    });
    expect(sql).toContain('IN');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('task/status');
    expect(params).toContain('open');
    expect(params).toContain('closed');
  });

  test('wire query: string attribute key matches tag .key SQL', () => {
    const tag = buildWhereClause({
      type: '=',
      attribute: QTask.title.key,
      value: 'hello',
    });
    const wire = buildWhereClause({
      type: '=',
      attribute: asKeyword('task/title'),
      value: 'hello',
    });
    expect(wire.sql).toBe(tag.sql);
    expect(wire.params).toEqual(tag.params);
  });

  test('and clause combining namespaced attributes', () => {
    const { sql, params } = buildWhereClause({
      type: 'and',
      clauses: [
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: '=', attribute: QTask.done.key, value: false },
      ],
    });
    expect(sql).toContain('AND');
    expect(params).toEqual(['task/title', 'a', 'task/done', 'false']);
  });

  test('attribute with dot in namespace', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: QGameSession.score.key,
      value: 42,
    });
    expect(sql).toContain('->>');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('game.session/score');
    expect(params[1]).toBe('42');
  });
});

describe('->> value params cast to ::text (prevents PG "operator does not exist: text = <type>")', () => {
  test('= with boolean produces $N::text, not bare $N', () => {
    const pgSql = toPgSql({
      type: '=',
      attribute: QTask.done.key,
      value: true,
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).not.toMatch(/= \$2(?!::text)/);
  });

  test('= with number produces $N::text', () => {
    const pgSql = toPgSql({ type: '=', attribute: QTask.score.key, value: 42 });
    expect(pgSql).toContain('$2::text');
  });

  test('!= with boolean produces $N::text', () => {
    const pgSql = toPgSql({
      type: '!=',
      attribute: QTask.done.key,
      value: false,
    });
    expect(pgSql).toContain('$2::text');
  });

  test('gt/gte/lt/lte with number cast to ::numeric for magnitude order', () => {
    for (const type of ['gt', 'gte', 'lt', 'lte'] as const) {
      const pgSql = toPgSql({ type, attribute: QTask.score.key, value: 10 });
      expect(pgSql).toContain('::numeric');
      expect(pgSql).toContain('$2::numeric');
    }
  });

  test('gt/gte/lt/lte with non-number cast value to ::text', () => {
    const pgSql = toPgSql({
      type: 'gt',
      attribute: QTask.status.key,
      value: 'open',
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).not.toContain('::numeric');
  });

  test('in with mixed types casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open', true, 7],
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('not_in casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'not_in',
      attribute: QTask.status.key,
      values: [false, 'closed'],
    });
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('contains casts value to ::text', () => {
    const pgSql = toPgSql({
      type: 'contains',
      attribute: QTask.name.key,
      value: 'foo',
    });
    expect(pgSql).toContain('$2::text');
  });
});

describe('tiger-style invariants in query-builder-pg', () => {
  test('empty `in` short-circuits to (1 = 0) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: [],
    });
    expect(sql).toBe('(1 = 0)');
    expect(params).toEqual([]);
  });

  test('empty `not_in` short-circuits to (1 = 1) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'not_in',
      attribute: QTask.status.key,
      values: [],
    });
    expect(sql).toBe('(1 = 1)');
    expect(params).toEqual([]);
  });

  test('empty `and` short-circuits to vacuously true', () => {
    const { sql, params } = buildWhereClause({ type: 'and', clauses: [] });
    expect(sql).toBe('(1 = 1)');
    expect(params).toEqual([]);
  });

  test('empty `or` short-circuits to vacuously false', () => {
    const { sql, params } = buildWhereClause({ type: 'or', clauses: [] });
    expect(sql).toBe('(1 = 0)');
    expect(params).toEqual([]);
  });

  test('empty `in` nested under `and` yields ((other) AND (1 = 0))', () => {
    const { sql, params } = buildWhereClause({
      type: 'and',
      clauses: [
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: 'in', attribute: QTask.status.key, values: [] },
      ],
    });
    expect(sql).toContain('(1 = 0)');
    expect(sql).toContain(' AND ');
    expect(params).toEqual(['task/title', 'a']);
  });

  test('empty `not_in` nested under `or` yields ((other) OR (1 = 1))', () => {
    const { sql, params } = buildWhereClause({
      type: 'or',
      clauses: [
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: 'not_in', attribute: QTask.status.key, values: [] },
      ],
    });
    expect(sql).toContain('(1 = 1)');
    expect(sql).toContain(' OR ');
    expect(params).toEqual(['task/title', 'a']);
  });

  test('empty entityId[] in snapshot conditions short-circuits to 1 = 0', () => {
    const { conditions, params } = buildSnapshotConditions({ entityId: [] });
    expect(conditions).toContain('1 = 0');
    expect(params).toEqual([]);
  });

  test('empty entityId[] in patch conditions short-circuits to 1 = 0', () => {
    const { conditions, params } = buildPatchConditions({ entityId: [] });
    expect(conditions).toContain('1 = 0');
    expect(params).toEqual([]);
  });

  test('rejects unsafe column prefix interpolated into WHERE', () => {
    expect(() =>
      buildWhereClause(
        { type: 'exists', attribute: QTask.title.key },
        'p; DROP--'
      )
    ).toThrow();
  });

  test('rejects unsafe table alias interpolated into patch conditions', () => {
    expect(() =>
      buildPatchConditions({ entityType: 'task' }, 'p; DROP TABLE patches; --')
    ).toThrow();
  });

  test('rejects negative limit', () => {
    expect(() => buildLimitSQL({ limit: -1 })).toThrow();
  });

  test('rejects fractional offset', () => {
    expect(() => buildLimitSQL({ offset: 1.5 })).toThrow();
  });

  test('rejects unsafe attributePrefix in ORDER BY', () => {
    expect(() =>
      buildOrderSQL(
        { orderBy: [{ attribute: QTask.title.key, direction: 'asc' }] },
        'ORDER BY id ASC',
        'p; DROP--'
      )
    ).toThrow();
  });

  test('wire query: string attribute in ORDER BY matches tag .key', () => {
    const def = 'ORDER BY id ASC';
    const tag = buildOrderSQL(
      { orderBy: [{ attribute: QTask.title.key, direction: 'desc' }] },
      def,
      ''
    );
    const wire = buildOrderSQL(
      { orderBy: [{ attribute: asKeyword('task/title'), direction: 'desc' }] },
      def,
      ''
    );
    expect(wire).toBe(tag);
  });

  test('numeric ORDER BY emits ::numeric cast when schema is supplied', () => {
    // Without schema → text comparison (broken on numbers, but back-compat).
    const def = 'ORDER BY entity_id ASC';
    const withoutRegistry = buildOrderSQL(
      {
        entityType: 'task',
        orderBy: [{ attribute: QTask.score.key, direction: 'desc' }],
      },
      def
    );
    expect(withoutRegistry).toContain(
      `(attributes::jsonb ->> 'task/score') DESC`
    );
    expect(withoutRegistry).not.toContain(`::numeric`);

    // With schema → numeric cast so the planner can walk the covering
    // numeric expression-index instead of a Sort node on text values.
    const schemaRegistry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: { score: QTask.score.indexed({ sortable: true }) },
        })
      )
      .freeze();
    const withRegistry = buildOrderSQL(
      {
        entityType: 'task',
        orderBy: [{ attribute: QTask.score.key, direction: 'desc' }],
      },
      def,
      '',
      { schemaRegistry }
    );
    expect(withRegistry).toContain(
      `((attributes::jsonb ->> 'task/score')::numeric) DESC`
    );
  });

  test('text ORDER BY stays text even with schema', () => {
    const schemaRegistry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: { title: QTask.title },
        })
      )
      .freeze();
    const sql = buildOrderSQL(
      {
        entityType: 'task',
        orderBy: [{ attribute: QTask.title.key, direction: 'asc' }],
      },
      'ORDER BY entity_id ASC',
      '',
      { schemaRegistry }
    );
    expect(sql).toContain(`(attributes::jsonb ->> 'task/title') ASC`);
    expect(sql).not.toContain(`::numeric`);
  });

  test('schema lookup with unknown entityType falls back to text', () => {
    const schemaRegistry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: { score: QTask.score.indexed({ sortable: true }) },
        })
      )
      .freeze();
    const sql = buildOrderSQL(
      {
        // entityType not registered — builder must not invent a cast.
        entityType: 'unknown',
        orderBy: [{ attribute: QTask.score.key, direction: 'desc' }],
      },
      'ORDER BY entity_id ASC',
      '',
      { schemaRegistry }
    );
    expect(sql).not.toContain(`::numeric`);
  });

  test('happy path: builds well-formed `in` clause for non-empty values', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open'],
    });
    expect(sql).toContain('IN (?::text)');
    expect(params).toEqual(['task/status', 'open']);
  });
});

describe('partition-aware query builder (Phase 1: generated columns)', () => {
  function partitionedRegistryOptions(): PgQueryBuilderOptions {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: {
            score: QTask.score.indexed({ sortable: true }),
            status: QTask.status.indexed(),
            title: QTask.title,
          },
        })
      )
      .freeze();
    return {
      schemaRegistry: registry,
      partitions: buildPartitionLayout(registry),
    };
  }

  test('snapshot SELECT switches to partition table when registry knows entity type', () => {
    const options = partitionedRegistryOptions();
    const { conditions, source } = buildSnapshotConditions(
      { entityType: 'task' },
      options
    );
    expect(source.hasTypedColumns).toBe(true);
    expect(source.table).toBe('snapshots__task');
    expect(conditions[0]).toBe('s.entity_type = ?');
  });

  test('numeric `gte` on indexed attribute compiles to typed generated-column comparison', () => {
    const options = partitionedRegistryOptions();
    const { conditions, params } = buildSnapshotConditions(
      {
        entityType: 'task',
        where: { type: 'gte', attribute: QTask.score.key, value: 100 },
      },
      options
    );
    const where = conditions[conditions.length - 1] ?? '';
    // Generated column path emits a direct typed comparison; the cast is
    // `::numeric` (matching the column type) and there's no JSONB extract.
    expect(where).toContain('s.gc_task__score >= ?::numeric');
    expect(where).not.toContain('->>');
    expect(params).toContain('task');
    expect(params).toContain(100);
  });

  test('text `=` on indexed attribute uses the generated text column', () => {
    const options = partitionedRegistryOptions();
    const { conditions, params } = buildSnapshotConditions(
      {
        entityType: 'task',
        where: { type: '=', attribute: QTask.status.key, value: 'open' },
      },
      options
    );
    const where = conditions[conditions.length - 1] ?? '';
    expect(where).toContain('s.gc_task__status = ?::text');
    expect(where).not.toContain('->>');
    expect(params).toContain('open');
  });

  test('non-indexed attribute on a registered entity falls back to JSONB extract', () => {
    const options = partitionedRegistryOptions();
    const { conditions } = buildSnapshotConditions(
      {
        entityType: 'task',
        where: { type: '=', attribute: QTask.title.key, value: 'hi' },
      },
      options
    );
    const where = conditions[conditions.length - 1] ?? '';
    expect(where).toContain('->>');
    expect(where).not.toContain('s.gc_task__title');
  });

  test('orderBy switches to generated column when one is registered', () => {
    const options = partitionedRegistryOptions();
    const sql = buildOrderSQL(
      {
        entityType: 'task',
        orderBy: [{ attribute: QTask.score.key, direction: 'desc' }],
      },
      'ORDER BY s.entity_id ASC',
      's.',
      options
    );
    expect(sql).toContain('s.gc_task__score DESC');
    expect(sql).not.toContain('->>');
  });
});

describe('subquery RHS on `not_in` / `in` (Phase 2)', () => {
  function chessRegistryOptions(): PgQueryBuilderOptions {
    const registry = createEntitySchemaRegistry()
      .register(
        defineEntitySchema({
          entityType: 'task',
          attributes: {
            status: QTask.status.indexed(),
          },
        })
      )
      .register(
        defineEntitySchema({
          entityType: 'item',
          attributes: {
            tag: asTagFromQItem(),
          },
        })
      )
      .freeze();
    return {
      schemaRegistry: registry,
      partitions: buildPartitionLayout(registry),
    };
  }

  /** Local helper — re-import QItem.tag with `.indexed()` for these tests. */
  function asTagFromQItem() {
    // Import inside the helper to avoid hoisting issues with bun:test.
    const { QItem } = require('../test/query-test-attrs') as {
      QItem: { tag: { indexed: (s?: unknown) => unknown } };
    };
    return QItem.tag.indexed() as never;
  }

  test('not_in with SubqueryRef compiles to nested SELECT with 3-valued NOT IN', () => {
    const options = chessRegistryOptions();
    const { sql, params } = buildWhereClause({
      type: 'not_in',
      attribute: QTask.status.key,
      values: {
        entityType: 'item',
        attribute: asKeyword('item/tag'),
        where: {
          type: '=',
          attribute: asKeyword('item/tag'),
          value: 'forbidden',
        },
      },
    });
    // `buildWhereClause` (back-compat entry) doesn't carry partition info,
    // so the inner SELECT lands on the parent `snapshots` table.
    expect(sql).toContain('NOT IN (SELECT');
    expect(sql).toContain('FROM snapshots sub');
    expect(sql).toContain('IS NULL OR');
    expect(params).toContain('item');
    expect(params).toContain('forbidden');
    void options;
  });

  test('subquery resolves to inner partition + generated column when registered', () => {
    const options = chessRegistryOptions();
    const { conditions, params } = buildSnapshotConditions(
      {
        entityType: 'task',
        where: {
          type: 'not_in',
          attribute: QTask.status.key,
          values: {
            entityType: 'item',
            attribute: asKeyword('item/tag'),
            where: {
              type: '=',
              attribute: asKeyword('item/tag'),
              value: 'forbidden',
            },
          },
        },
      },
      options
    );
    const sql = conditions[conditions.length - 1] ?? '';
    // Outer column: gen col on snapshots__task.
    expect(sql).toContain('s.gc_task__status');
    // Inner SELECT: gen col on snapshots__item.
    expect(sql).toContain('FROM snapshots__item sub');
    expect(sql).toContain('SELECT sub.gc_item__tag');
    // 3-valued NOT IN preserved.
    expect(sql).toContain('IS NULL OR');
    // Params include outer entity_type, inner entity_type, and the literal.
    expect(params).toContain('task');
    expect(params).toContain('item');
    expect(params).toContain('forbidden');
  });

  test('recursive subquery: not_in -> in -> not_in nested compiles to two SELECTs', () => {
    const { sql } = buildWhereClause({
      type: 'not_in',
      attribute: QTask.status.key,
      values: {
        entityType: 'item',
        attribute: asKeyword('item/tag'),
        where: {
          type: 'in',
          attribute: asKeyword('item/tag'),
          values: {
            entityType: 'task',
            attribute: QTask.status.key,
            where: {
              type: '=',
              attribute: QTask.status.key,
              value: 'open',
            },
          },
        },
      },
    });
    expect(sql.match(/SELECT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain('NOT IN');
    expect(sql).toContain('IN (SELECT');
  });

  test('rejects subquery nesting beyond MAX_SUBQUERY_DEPTH', () => {
    expect(MAX_SUBQUERY_DEPTH).toBeGreaterThanOrEqual(2);
    // Build a chain of `MAX_SUBQUERY_DEPTH + 1` nested subqueries, which
    // must crash before generating SQL.
    type W = Parameters<typeof buildWhereClause>[0];
    let inner: W = {
      type: '=',
      attribute: QTask.status.key,
      value: 'leaf',
    };
    for (let i = 0; i <= MAX_SUBQUERY_DEPTH; i++) {
      inner = {
        type: 'in',
        attribute: QTask.status.key,
        values: {
          entityType: 'task',
          attribute: QTask.status.key,
          where: inner,
        },
      };
    }
    expect(() => buildWhereClause(inner)).toThrow();
  });

  test('not_in with empty array still short-circuits (1 = 1) — subquery wrapping does not affect array-empty path', () => {
    const { sql } = buildWhereClause({
      type: 'not_in',
      attribute: QTask.status.key,
      values: [],
    });
    expect(sql).toBe('(1 = 1)');
  });
});
