import { assert } from '@gamezilla/lib/assert';
import {
  assertOffsetLimitFragment,
  assertOrderByFragment,
} from '@gamezilla/lib/sqlite';
import type { PatchesDbQuery, PatchesDbQueryWhereClause } from '../interface';
import { assertAttribute, assertDirection } from '../interface';

export type WhereFragment = { sql: string; params: unknown[] };

/** Builds JSON path for keys; uses quoted form for keys with . / [ ] */
function jsonPathForAttribute(attribute: string): string {
  assertAttribute(attribute);
  return /[./[\]]/.test(attribute)
    ? `$."${attribute.replace(/"/g, '""')}"`
    : `$.${attribute}`;
}
assert.equals(
  jsonPathForAttribute('todo/title'),
  '$."todo/title"',
  'Invalid attribute name',
  { attribute: 'todo/title' }
);
assert.equals(
  jsonPathForAttribute('my.namespace/attr'),
  '$."my.namespace/attr"',
  'Invalid attribute name',
  { attribute: 'my.namespace/attr' }
);
assert.equals(
  jsonPathForAttribute('todo/title'),
  '$."todo/title"',
  'Invalid attribute name.',
  { attribute: 'todo/title' }
);

type BinaryClause = Extract<
  PatchesDbQueryWhereClause,
  { type: '=' | '!=' | 'gt' | 'gte' | 'lt' | 'lte' }
>;
type SetClause = Extract<PatchesDbQueryWhereClause, { type: 'in' | 'not_in' }>;
type ExistenceClause = Extract<
  PatchesDbQueryWhereClause,
  { type: 'exists' | 'not_exists' }
>;
type AndOrClause = Extract<PatchesDbQueryWhereClause, { type: 'and' | 'or' }>;
type ContainsClause = Extract<PatchesDbQueryWhereClause, { type: 'contains' }>;
type NotClause = Extract<PatchesDbQueryWhereClause, { type: 'not' }>;

const BINARY_OPS_SQL: Record<BinaryClause['type'], string> = {
  '=': '=',
  '!=': '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

function buildBinaryClause(
  clause: BinaryClause,
  jsonColumn: string
): WhereFragment {
  assertAttribute(clause.attribute);
  const path = jsonPathForAttribute(clause.attribute);
  const op = BINARY_OPS_SQL[clause.type];
  return {
    sql: `json_extract(${jsonColumn}, ?) ${op} ?`,
    params: [path, clause.value],
  };
}

function buildContainsClause(
  clause: ContainsClause,
  jsonColumn: string
): WhereFragment {
  assertAttribute(clause.attribute);
  const path = jsonPathForAttribute(clause.attribute);
  return {
    sql: `json_extract(${jsonColumn}, ?) LIKE '%' || ? || '%'`,
    params: [path, clause.value],
  };
}

function buildSetClause(
  clause: SetClause,
  jsonColumn: string
): WhereFragment {
  assertAttribute(clause.attribute);
  const path = jsonPathForAttribute(clause.attribute);
  const placeholders = clause.values.map(() => '?').join(', ');
  const op = clause.type === 'in' ? 'IN' : 'NOT IN';
  return {
    sql: `json_extract(${jsonColumn}, ?) ${op} (${placeholders})`,
    params: [path, ...clause.values],
  };
}

function buildExistenceClause(
  clause: ExistenceClause,
  jsonColumn: string
): WhereFragment {
  assertAttribute(clause.attribute);
  const path = jsonPathForAttribute(clause.attribute);
  const op = clause.type === 'exists' ? 'IS NOT NULL' : 'IS NULL';
  return {
    sql: `json_extract(${jsonColumn}, ?) ${op}`,
    params: [path],
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

function buildNotClause(
  clause: NotClause,
  jsonColumn: string
): WhereFragment {
  const inner = buildWhereClauseForColumn(clause.clause, jsonColumn);
  return { sql: `NOT (${inner.sql})`, params: inner.params };
}

type ClauseBuilder = (
  clause: PatchesDbQueryWhereClause,
  jsonColumn: string
) => WhereFragment;

const CLAUSE_BUILDERS: Record<PatchesDbQueryWhereClause['type'], ClauseBuilder> =
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
  clause: PatchesDbQueryWhereClause,
  jsonColumn: string
): WhereFragment {
  const builder = CLAUSE_BUILDERS[clause.type];
  assert.defined(builder, 'Invalid where clause type');
  return builder(clause, jsonColumn);
}

export function buildWhereClause(
  clause: PatchesDbQueryWhereClause,
  columnPrefix = ''
): WhereFragment {
  const jsonColumn = `${columnPrefix}attributes`;
  return buildWhereClauseForColumn(clause, jsonColumn);
}

export function buildSnapshotConditions(query: PatchesDbQuery): {
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
  query: PatchesDbQuery,
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
  query: PatchesDbQuery,
  defaultOrder: string,
  attributePrefix = ''
): string {
  if (query.orderBy && query.orderBy.length > 0) {
    const custom = query.orderBy
      .map((o) => {
        const path = jsonPathForAttribute(o.attribute);
        assertDirection(o.direction);
        const dir = o.direction === 'desc' ? 'DESC' : 'ASC';
        return `json_extract(${attributePrefix}attributes, '${path.replace(/'/g, "''")}') ${dir}`;
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

export function buildLimitSQL(query: PatchesDbQuery): {
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
