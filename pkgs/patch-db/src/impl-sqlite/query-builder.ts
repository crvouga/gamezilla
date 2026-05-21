import { assert } from '@gamezilla/assert';
import { asKeyword } from '@gamezilla/keyword';
import {
  assertOffsetLimitFragment,
  assertOrderByFragment,
  assertSqlPrefix,
  assertWhereFragment,
} from '@gamezilla/sqlite';
import type {
  AttributeKey,
  PatchDbQuery,
  PatchDbQueryWhereClause,
} from '../interface';
import {
  assertAttribute,
  assertDirection,
  patchDbAttributeKey,
} from '../interface';

export type WhereFragment = { sql: string; params: unknown[] };

/** Builds JSON path for keys; uses quoted form for keys with . / [ ] */
function jsonPathForAttribute(attribute: AttributeKey): string {
  assertAttribute(attribute);
  return /[./[\]]/.test(attribute)
    ? `$."${attribute.replace(/"/g, '""')}"`
    : `$.${attribute}`;
}
assert.equals(
  jsonPathForAttribute(asKeyword('todo/title')),
  '$."todo/title"',
  'Invalid attribute name',
  { attribute: 'todo/title' }
);
assert.equals(
  jsonPathForAttribute(asKeyword('my.namespace/attr-name')),
  '$."my.namespace/attr-name"',
  'Invalid attribute name',
  { attribute: 'my.namespace/attr-name' }
);
assert.equals(
  jsonPathForAttribute(asKeyword('todo/title')),
  '$."todo/title"',
  'Invalid attribute name.',
  { attribute: 'todo/title' }
);

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
  const attrKey = patchDbAttributeKey(clause.attribute);
  const path = jsonPathForAttribute(attrKey);
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
  const attrKey = patchDbAttributeKey(clause.attribute);
  const path = jsonPathForAttribute(attrKey);
  return {
    sql: `json_extract(${jsonColumn}, ?) LIKE '%' || ? || '%'`,
    params: [path, clause.value],
  };
}

function buildSetClause(clause: SetClause, jsonColumn: string): WhereFragment {
  const attrKey = patchDbAttributeKey(clause.attribute);
  assert.ok(
    Array.isArray(clause.values) && clause.values.length > 0,
    `Empty values list for ${clause.type} clause would produce invalid SQL "IN ()"`,
    { clause }
  );
  const path = jsonPathForAttribute(attrKey);
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
  const attrKey = patchDbAttributeKey(clause.attribute);
  const path = jsonPathForAttribute(attrKey);
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
  assert.ok(
    Array.isArray(clause.clauses) && clause.clauses.length > 0,
    `Empty clauses list for ${clause.type} clause would produce invalid SQL "()"`,
    { clause }
  );
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

/** Always-false predicate, used to short-circuit `in []` / `or []`. */
const ALWAYS_FALSE: WhereFragment = { sql: '(1 = 0)', params: [] };
/** Always-true predicate, used to short-circuit `not_in []` / `and []`. */
const ALWAYS_TRUE: WhereFragment = { sql: '(1 = 1)', params: [] };

/**
 * Returns a trivial WhereFragment when `clause` is an empty collection clause
 * whose answer is fixed by set theory — `in []` matches nothing, `not_in []`
 * matches everything, `and []` is vacuously true, `or []` is vacuously false.
 *
 * Short-circuiting here keeps the assertion in {@link buildSetClause} /
 * {@link buildAndOrClause} as a real defense — those should never be called
 * with an empty collection — while letting the caller pass a runtime-derived
 * empty list (e.g. an ABAC predicate when the user has zero memberships)
 * without crashing.
 */
function trivialFragmentForEmptyCollection(
  clause: PatchDbQueryWhereClause
): WhereFragment | null {
  if (clause.type === 'in' && clause.values.length === 0) return ALWAYS_FALSE;
  if (clause.type === 'not_in' && clause.values.length === 0) {
    return ALWAYS_TRUE;
  }
  if (clause.type === 'and' && clause.clauses.length === 0) return ALWAYS_TRUE;
  if (clause.type === 'or' && clause.clauses.length === 0) return ALWAYS_FALSE;
  return null;
}

function buildWhereClauseForColumn(
  clause: PatchDbQueryWhereClause,
  jsonColumn: string
): WhereFragment {
  const trivial = trivialFragmentForEmptyCollection(clause);
  if (trivial !== null) return trivial;
  const builder = CLAUSE_BUILDERS[clause.type];
  assert.defined(builder, 'Invalid where clause type');
  const fragment = builder(clause, jsonColumn);
  assertWhereFragment(fragment, { clauseType: clause.type, jsonColumn });
  return fragment;
}

export function buildWhereClause(
  clause: PatchDbQueryWhereClause,
  columnPrefix = ''
): WhereFragment {
  assertSqlPrefix(columnPrefix, 'Invalid column prefix for where clause');
  const jsonColumn = `${columnPrefix}attributes`;
  return buildWhereClauseForColumn(clause, jsonColumn);
}

/**
 * Pushes an `entity_id = ?` / `entity_id IN (?, …)` predicate onto `conditions`.
 *
 * An empty `entityId[]` short-circuits the whole query to "no matches" by
 * pushing `1=0` — same semantics as `in []` in {@link buildSetClause}.
 */
function pushEntityIdCondition(
  query: PatchDbQuery,
  conditions: string[],
  params: unknown[],
  columnExpr: string
): void {
  if (query.entityId === null || query.entityId === undefined) return;
  if (Array.isArray(query.entityId)) {
    if (query.entityId.length === 0) {
      conditions.push('1 = 0');
      return;
    }
    const placeholders = query.entityId.map(() => '?').join(', ');
    conditions.push(`${columnExpr} IN (${placeholders})`);
    params.push(...query.entityId);
    return;
  }
  conditions.push(`${columnExpr} = ?`);
  params.push(query.entityId);
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

  pushEntityIdCondition(query, conditions, params, 'entity_id');

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
  assertSqlPrefix(
    `${tableAlias}.`,
    'Invalid tableAlias for patch conditions (must be a simple SQL identifier)'
  );
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push(`${tableAlias}.entity_type = ?`);
    params.push(query.entityType);
  }

  pushEntityIdCondition(query, conditions, params, `${tableAlias}.entity_id`);

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
  assertSqlPrefix(
    attributePrefix,
    'Invalid attributePrefix for ORDER BY (must be empty or "<identifier>.")'
  );
  if (query.orderBy && query.orderBy.length > 0) {
    const custom = query.orderBy
      .map((o) => {
        const path = jsonPathForAttribute(patchDbAttributeKey(o.attribute));
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

export function buildLimitSQL(query: PatchDbQuery): {
  sql: string;
  params: unknown[];
} {
  let sql = '';
  const params: unknown[] = [];
  if (query.limit !== null && query.limit !== undefined) {
    assert.nonNegativeInteger(
      query.limit,
      'query.limit must be a non-negative safe integer'
    );
    sql += ' LIMIT ?';
    params.push(query.limit);
  }
  if (query.offset !== null && query.offset !== undefined) {
    assert.nonNegativeInteger(
      query.offset,
      'query.offset must be a non-negative safe integer'
    );
    sql += ' OFFSET ?';
    params.push(query.offset);
  }
  assertOffsetLimitFragment(sql);
  return { sql, params };
}
