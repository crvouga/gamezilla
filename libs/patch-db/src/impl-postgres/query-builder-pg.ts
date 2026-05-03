import { assert } from '@gamezilla/lib/assert';
import {
  assertOffsetLimitFragment,
  assertOrderByFragment,
} from '@gamezilla/lib/sqlite';
import type { PatchDbQuery, PatchDbQueryWhereClause } from '../interface';
import { assertAttribute, assertDirection } from '../interface';
import { sqliteJsonPathToKey } from './json-path';

export type WhereFragment = { sql: string; params: unknown[] };

/**
 * PGlite's extended query protocol requires params to match the SQL-declared
 * type exactly.  Since our WHERE clauses use `?::text` to compare against the
 * text output of JSONB `->>`, every value in that position must be a string.
 */
function toTextParam(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return String(v);
  return String(v);
}

/** Builds JSON path for keys; uses same quoting rules as SQLite query-builder */
function jsonPathForAttribute(attribute: string): string {
  assertAttribute(attribute);
  return /[./[\]]/.test(attribute)
    ? `$."${attribute.replace(/"/g, '""')}"`
    : `$.${attribute}`;
}

type BinaryClause = Extract<
  PatchDbQueryWhereClause,
  { type: '=' | '!=' | 'gt' | 'gte' | 'lt' | 'lte' }
>;
type SetClause = Extract<PatchDbQueryWhereClause, { type: 'in' | 'not_in' }>;
type ExistenceClause = Extract<
  PatchDbQueryWhereClause,
  { type: 'exists' | 'not_exists' }
>;
type AndOrClause = Extract<PatchDbQueryWhereClause, { type: 'and' | 'or' }>;
type ContainsClause = Extract<PatchDbQueryWhereClause, { type: 'contains' }>;
type NotClause = Extract<PatchDbQueryWhereClause, { type: 'not' }>;

const BINARY_OPS_SQL: Record<BinaryClause['type'], string> = {
  '=': '= ?::text',
  '!=': 'IS DISTINCT FROM ?::text',
  gt: '> ?::text',
  gte: '>= ?::text',
  lt: '< ?::text',
  lte: '<= ?::text',
};

function attributeKey(attribute: string): string {
  assertAttribute(attribute);
  return sqliteJsonPathToKey(jsonPathForAttribute(attribute));
}

function buildBinaryClause(
  clause: BinaryClause,
  jsonColumn: string
): WhereFragment {
  const col = `${jsonColumn}::jsonb`;
  const key = attributeKey(clause.attribute);
  const opTail = BINARY_OPS_SQL[clause.type];
  return {
    sql: `(${col} ->> ?) ${opTail}`,
    params: [key, toTextParam(clause.value)],
  };
}

function buildContainsClause(
  clause: ContainsClause,
  jsonColumn: string
): WhereFragment {
  const col = `${jsonColumn}::jsonb`;
  const key = attributeKey(clause.attribute);
  return {
    sql: `(${col} ->> ?) LIKE '%' || ?::text || '%'`,
    params: [key, toTextParam(clause.value)],
  };
}

function buildSetClause(clause: SetClause, jsonColumn: string): WhereFragment {
  const col = `${jsonColumn}::jsonb`;
  const key = attributeKey(clause.attribute);
  const placeholders = clause.values.map(() => '?::text').join(', ');
  if (clause.type === 'in') {
    return {
      sql: `(${col} ->> ?) IN (${placeholders})`,
      params: [key, ...clause.values.map(toTextParam)],
    };
  }
  return {
    sql: `((${col} ->> ?) IS NULL OR (${col} ->> ?) NOT IN (${placeholders}))`,
    params: [key, key, ...clause.values.map(toTextParam)],
  };
}

function buildExistenceClause(
  clause: ExistenceClause,
  jsonColumn: string
): WhereFragment {
  const col = `${jsonColumn}::jsonb`;
  const key = attributeKey(clause.attribute);
  const op = clause.type === 'exists' ? 'IS NOT NULL' : 'IS NULL';
  return {
    sql: `(${col} -> ?) ${op}`,
    params: [key],
  };
}

function buildAndOrClause(
  clause: AndOrClause,
  jsonColumn: string
): WhereFragment {
  const parts = clause.clauses.map((c) =>
    buildWhereClauseForColumn(c, jsonColumn)
  );
  const sep = clause.type === 'and' ? ' AND ' : ' OR ';
  return {
    sql: `(${parts.map((p) => p.sql).join(sep)})`,
    params: parts.flatMap((p) => p.params),
  };
}

function buildNotClause(clause: NotClause, jsonColumn: string): WhereFragment {
  const inner = buildWhereClauseForColumn(clause.clause, jsonColumn);
  return { sql: `NOT (${inner.sql})`, params: inner.params };
}

type ClauseBuilder = (
  clause: PatchDbQueryWhereClause,
  jsonColumn: string
) => WhereFragment;

const CLAUSE_BUILDERS: Record<PatchDbQueryWhereClause['type'], ClauseBuilder> =
  {
    '=': (c, j) => buildBinaryClause(c as BinaryClause, j),
    '!=': (c, j) => buildBinaryClause(c as BinaryClause, j),
    gt: (c, j) => buildBinaryClause(c as BinaryClause, j),
    gte: (c, j) => buildBinaryClause(c as BinaryClause, j),
    lt: (c, j) => buildBinaryClause(c as BinaryClause, j),
    lte: (c, j) => buildBinaryClause(c as BinaryClause, j),
    contains: (c, j) => buildContainsClause(c as ContainsClause, j),
    in: (c, j) => buildSetClause(c as SetClause, j),
    not_in: (c, j) => buildSetClause(c as SetClause, j),
    exists: (c, j) => buildExistenceClause(c as ExistenceClause, j),
    not_exists: (c, j) => buildExistenceClause(c as ExistenceClause, j),
    and: (c, j) => buildAndOrClause(c as AndOrClause, j),
    or: (c, j) => buildAndOrClause(c as AndOrClause, j),
    not: (c, j) => buildNotClause(c as NotClause, j),
  };

function buildWhereClauseForColumn(
  clause: PatchDbQueryWhereClause,
  jsonColumn: string
): WhereFragment {
  const builder = CLAUSE_BUILDERS[clause.type];
  assert.defined(builder, 'Invalid where clause type');
  return builder(clause, jsonColumn);
}

export function buildWhereClause(
  clause: PatchDbQueryWhereClause,
  columnPrefix = ''
): WhereFragment {
  const jsonColumn = `${columnPrefix}attributes`;
  return buildWhereClauseForColumn(clause, jsonColumn);
}

export function buildSnapshotConditions(query: PatchDbQuery): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push('entity_type = ?');
    params.push(query.entityType);
  }

  if (query.entityId !== null && query.entityId !== undefined) {
    if (Array.isArray(query.entityId)) {
      const placeholders = query.entityId.map(() => '?').join(', ');
      conditions.push(`entity_id IN (${placeholders})`);
      params.push(...query.entityId);
    } else {
      conditions.push('entity_id = ?');
      params.push(query.entityId);
    }
  }

  if (query.where) {
    const fragment = buildWhereClause(query.where);
    conditions.push(fragment.sql);
    params.push(...fragment.params);
  }

  if (conditions.length === 0) {
    conditions.push('1=1');
  }

  return { conditions, params };
}

export function buildPatchConditions(
  query: PatchDbQuery,
  tableAlias = 'p'
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push(`${tableAlias}.entity_type = ?`);
    params.push(query.entityType);
  }

  if (query.entityId !== null && query.entityId !== undefined) {
    if (Array.isArray(query.entityId)) {
      const placeholders = query.entityId.map(() => '?').join(', ');
      conditions.push(`${tableAlias}.entity_id IN (${placeholders})`);
      params.push(...query.entityId);
    } else {
      conditions.push(`${tableAlias}.entity_id = ?`);
      params.push(query.entityId);
    }
  }

  if (query.where) {
    const jsonColumn = `${tableAlias}.attributes`;
    const fragment = buildWhereClauseForColumn(query.where, jsonColumn);
    conditions.push(fragment.sql);
    params.push(...fragment.params);
  }

  if (conditions.length === 0) {
    conditions.push('1=1');
  }

  return { conditions, params };
}

export function buildOrderSQL(
  query: PatchDbQuery,
  defaultOrder: string,
  attributePrefix = ''
): string {
  if (query.orderBy && query.orderBy.length > 0) {
    const custom = query.orderBy
      .map((o) => {
        const path = jsonPathForAttribute(o.attribute);
        const key = sqliteJsonPathToKey(path);
        const escaped = key.replace(/'/g, "''");
        assertDirection(o.direction);
        const dir = o.direction === 'desc' ? 'DESC' : 'ASC';
        return `(${attributePrefix}attributes::jsonb ->> '${escaped}') ${dir}`;
      })
      .join(', ');
    const tiebreaker = defaultOrder.replace(/^ORDER BY\s+/i, '');
    const orderBy = `ORDER BY ${custom}, ${tiebreaker}`;
    assertOrderByFragment(orderBy);
    return orderBy;
  }
  assertOrderByFragment(defaultOrder);
  return defaultOrder;
}

export function buildLimitSQL(query: PatchDbQuery): {
  sql: string;
  params: unknown[];
} {
  let sql = '';
  const params: unknown[] = [];
  if (query.limit !== null && query.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(query.limit);
  }
  if (query.offset !== null && query.offset !== undefined) {
    sql += ' OFFSET ?';
    params.push(query.offset);
  }
  assertOffsetLimitFragment(sql);
  return { sql, params };
}
