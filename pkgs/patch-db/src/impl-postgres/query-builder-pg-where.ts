/**
 * WHERE clause builders for the Postgres engine. Lives in its own file so
 * the main builder stays under the Tiger-style file-size cap. Exposes the
 * small surface that {@link ./query-builder-pg-snapshot} (and the public
 * back-compat entry in {@link ./query-builder-pg}) need: `WhereCtx`,
 * `buildWhereClauseForColumn`, `buildWhereClauseInCtx`, the `WhereFragment`
 * type, and the `MAX_SUBQUERY_DEPTH` recursion bound.
 */
import { assert } from '@pkgs/assert';
import type { DataType } from '@pkgs/attribute';
import type { Keyword } from '@pkgs/keyword';
import {
  assertSqlIdentifier,
  assertSqlPrefix,
  assertWhereFragment,
} from '@pkgs/sql';
import type {
  AttributeKey,
  PatchDbQueryWhereClause,
  PatchEntityType,
  SubqueryRef,
} from '../interface';
import {
  assertAttribute,
  isSubqueryRef,
  patchDbAttributeKey,
} from '../interface';
import { sqliteJsonPathToKey } from './json-path';
import type { GeneratedColumnSpec } from './partitioning';
import { pgColumnTypeFor } from './partitioning';
import type { PgQueryBuilderOptions } from './query-builder-pg-options';

export type { PgQueryBuilderOptions } from './query-builder-pg-options';

export type WhereFragment = { sql: string; params: unknown[] };

/**
 * Hard cap on subquery recursion depth. Untrusted inputs (HTTP wire
 * payloads) cannot push past this without crashing first — protects the
 * planner from pathological N-deep nestings.
 */
export const MAX_SUBQUERY_DEPTH = 4;

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
export function jsonPathForAttribute(attribute: AttributeKey): string {
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

const BINARY_OPS_RAW: Record<BinaryClause['type'], string> = {
  '=': '=',
  '!=': 'IS DISTINCT FROM',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

/**
 * Order-sensitive ops compared as text yield lexicographic comparison, which
 * silently wrong-answers on numeric attributes — e.g. `'1200' >= '800'` is
 * FALSE because `'1' < '8'`. For numeric `value`s we cast both sides to
 * `numeric` so range queries (`gt/gte/lt/lte`) sort by magnitude.
 *
 * Equality (`=`, `!=`) stays text-based: JSON numbers materialise back to
 * canonical text via `jsonb ->>` (e.g. `1200` → `'1200'`), so `'1200' = '1200'`
 * is correct without paying for a `numeric` cast.
 */
const NUMERIC_ORDER_OPS_SQL: Partial<Record<BinaryClause['type'], string>> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

function topLevelJsonKey(attribute: string): string {
  assertAttribute(attribute);
  return sqliteJsonPathToKey(jsonPathForAttribute(attribute));
}

type AttributeColumnRef =
  | {
      readonly kind: 'generated';
      readonly sqlExpr: string;
      readonly dataType: DataType;
    }
  | {
      readonly kind: 'jsonb';
      readonly jsonColumn: string;
      readonly attribute: AttributeKey;
    };

export type WhereCtx = {
  readonly jsonColumn: string;
  readonly entityType: PatchEntityType | undefined;
  readonly partitionAlias: string | null;
  readonly options: PgQueryBuilderOptions | undefined;
  readonly depth: number;
};

export function rootWhereCtx(
  jsonColumn: string,
  entityType: PatchEntityType | undefined,
  options: PgQueryBuilderOptions | undefined,
  partitionAlias: string | null = null
): WhereCtx {
  assertSqlPrefix(jsonColumn.replace(/attributes$/, ''), 'json column prefix');
  return {
    jsonColumn,
    entityType,
    partitionAlias,
    options,
    depth: 0,
  };
}

function lookupGeneratedColumn(
  ctx: WhereCtx,
  attribute: Keyword
): GeneratedColumnSpec | null {
  if (ctx.partitionAlias === null) return null;
  const partitions = ctx.options?.partitions;
  if (partitions === undefined || ctx.entityType === undefined) return null;
  const info = partitions.get(ctx.entityType);
  if (info === null) return null;
  return info.columnsByAttribute.get(attribute) ?? null;
}

function resolveAttributeColumn(
  ctx: WhereCtx,
  attribute: AttributeKey
): AttributeColumnRef {
  const key = patchDbAttributeKey(attribute);
  const gen = lookupGeneratedColumn(ctx, key);
  if (gen !== null) {
    assertSqlIdentifier(gen.columnName, 'generated column name');
    const prefix = ctx.partitionAlias === null ? '' : `${ctx.partitionAlias}.`;
    assertSqlPrefix(prefix, 'partition alias prefix');
    return {
      kind: 'generated',
      sqlExpr: `${prefix}${gen.columnName}`,
      dataType: gen.dataType,
    };
  }
  return { kind: 'jsonb', jsonColumn: ctx.jsonColumn, attribute: key };
}

function pgLiteralCastSuffix(dataType: DataType): string {
  return `::${pgColumnTypeFor(dataType)}`;
}

function normalizeGeneratedColumnParam(
  dataType: DataType,
  value: unknown
): unknown {
  if (dataType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
    return Boolean(value);
  }
  return value;
}

function buildBinaryClauseGenerated(
  clause: BinaryClause,
  ref: Extract<AttributeColumnRef, { kind: 'generated' }>
): WhereFragment {
  const op = BINARY_OPS_RAW[clause.type];
  const cast = pgLiteralCastSuffix(ref.dataType);
  return {
    sql: `(${ref.sqlExpr} ${op} ?${cast})`,
    params: [normalizeGeneratedColumnParam(ref.dataType, clause.value)],
  };
}

function buildBinaryClause(clause: BinaryClause, ctx: WhereCtx): WhereFragment {
  const ref = resolveAttributeColumn(ctx, clause.attribute);
  if (ref.kind === 'generated') {
    return buildBinaryClauseGenerated(clause, ref);
  }
  const col = `${ref.jsonColumn}::jsonb`;
  const key = topLevelJsonKey(ref.attribute);
  const numericOp = NUMERIC_ORDER_OPS_SQL[clause.type];
  if (numericOp !== undefined && typeof clause.value === 'number') {
    return {
      sql: `((${col} ->> ?)::numeric ${numericOp} ?::numeric)`,
      params: [key, clause.value],
    };
  }
  const opTail = BINARY_OPS_SQL[clause.type];
  return {
    sql: `(${col} ->> ?) ${opTail}`,
    params: [key, toTextParam(clause.value)],
  };
}

function buildContainsClause(
  clause: ContainsClause,
  ctx: WhereCtx
): WhereFragment {
  // `contains` stays JSONB-extract even when a generated column exists —
  // substring search isn't btree-acceleratable and the GIN path doesn't help.
  const ref = resolveAttributeColumn(ctx, clause.attribute);
  if (ref.kind === 'generated' && ref.dataType === 'text') {
    return {
      sql: `(${ref.sqlExpr} LIKE '%' || ?::text || '%')`,
      params: [toTextParam(clause.value)],
    };
  }
  const jsonColumn = ref.kind === 'jsonb' ? ref.jsonColumn : ctx.jsonColumn;
  const col = `${jsonColumn}::jsonb`;
  const key = topLevelJsonKey(patchDbAttributeKey(clause.attribute));
  return {
    sql: `(${col} ->> ?) LIKE '%' || ?::text || '%'`,
    params: [key, toTextParam(clause.value)],
  };
}

function buildSetClauseLiteralGenerated(
  clause: SetClause,
  ref: Extract<AttributeColumnRef, { kind: 'generated' }>,
  values: readonly unknown[]
): WhereFragment {
  const cast = pgLiteralCastSuffix(ref.dataType);
  const placeholders = values.map(() => `?${cast}`).join(', ');
  const params = values.map((v) =>
    normalizeGeneratedColumnParam(ref.dataType, v)
  );
  if (clause.type === 'in') {
    return {
      sql: `(${ref.sqlExpr} IN (${placeholders}))`,
      params,
    };
  }
  return {
    sql: `(${ref.sqlExpr} IS NULL OR ${ref.sqlExpr} NOT IN (${placeholders}))`,
    params,
  };
}

function buildSetClauseLiteralJsonb(
  clause: SetClause,
  ref: Extract<AttributeColumnRef, { kind: 'jsonb' }>,
  values: readonly unknown[]
): WhereFragment {
  const col = `${ref.jsonColumn}::jsonb`;
  const key = topLevelJsonKey(ref.attribute);
  const placeholders = values.map(() => '?::text').join(', ');
  if (clause.type === 'in') {
    return {
      sql: `(${col} ->> ?) IN (${placeholders})`,
      params: [key, ...values.map(toTextParam)],
    };
  }
  return {
    sql: `((${col} ->> ?) IS NULL OR (${col} ->> ?) NOT IN (${placeholders}))`,
    params: [key, key, ...values.map(toTextParam)],
  };
}

function buildSetClauseLiteral(
  clause: SetClause,
  ctx: WhereCtx,
  values: readonly unknown[]
): WhereFragment {
  assert.ok(
    values.length > 0,
    `Empty values list for ${clause.type} clause would produce invalid SQL "IN ()"`,
    { clause }
  );
  const ref = resolveAttributeColumn(ctx, clause.attribute);
  if (ref.kind === 'generated') {
    return buildSetClauseLiteralGenerated(clause, ref, values);
  }
  return buildSetClauseLiteralJsonb(clause, ref, values);
}

function partitionTableForSubquery(
  ctx: WhereCtx,
  entityType: PatchEntityType
): { from: string; alias: string } {
  const partitions = ctx.options?.partitions;
  if (partitions !== undefined) {
    const info = partitions.get(entityType);
    if (info !== null) {
      assertSqlIdentifier(info.tableName, 'subquery partition table name');
      return { from: info.tableName, alias: 'sub' };
    }
  }
  return { from: 'snapshots', alias: 'sub' };
}

function projectInnerColumn(
  innerCtx: WhereCtx,
  subquery: SubqueryRef
): { sqlExpr: string; params: unknown[] } {
  const innerCol = resolveAttributeColumn(innerCtx, subquery.attribute);
  if (innerCol.kind === 'generated') {
    return { sqlExpr: innerCol.sqlExpr, params: [] };
  }
  return {
    sqlExpr: `(${innerCol.jsonColumn}::jsonb ->> ?)`,
    params: [topLevelJsonKey(innerCol.attribute)],
  };
}

function projectOuterColumn(
  ctx: WhereCtx,
  outerClause: SetClause
): {
  sqlExpr: string;
  baseParams: readonly unknown[];
  isJsonb: boolean;
  jsonbKey: string | null;
} {
  const outerRef = resolveAttributeColumn(ctx, outerClause.attribute);
  if (outerRef.kind === 'generated') {
    return {
      sqlExpr: outerRef.sqlExpr,
      baseParams: [],
      isJsonb: false,
      jsonbKey: null,
    };
  }
  const key = topLevelJsonKey(outerRef.attribute);
  return {
    sqlExpr: `(${outerRef.jsonColumn}::jsonb ->> ?)`,
    baseParams: [key],
    isJsonb: true,
    jsonbKey: key,
  };
}

function buildSubqueryRhs(
  outerClause: SetClause,
  subquery: SubqueryRef,
  ctx: WhereCtx
): WhereFragment {
  assert.ok(
    ctx.depth < MAX_SUBQUERY_DEPTH,
    'subquery depth exceeds MAX_SUBQUERY_DEPTH',
    { depth: ctx.depth, max: MAX_SUBQUERY_DEPTH, outerClause }
  );
  const { from, alias } = partitionTableForSubquery(ctx, subquery.entityType);
  assertSqlIdentifier(alias, 'subquery alias');
  const innerCtx: WhereCtx = {
    jsonColumn: `${alias}.attributes`,
    entityType: subquery.entityType,
    partitionAlias: alias,
    options: ctx.options,
    depth: ctx.depth + 1,
  };
  const inner = projectInnerColumn(innerCtx, subquery);
  const conditions: string[] = [`${alias}.entity_type = ?`];
  const params: unknown[] = [subquery.entityType];
  if (subquery.where !== undefined) {
    const fragment = buildWhereClauseInCtx(subquery.where, innerCtx);
    conditions.push(fragment.sql);
    params.push(...fragment.params);
  }
  const innerSelect = `SELECT ${inner.sqlExpr} FROM ${from} ${alias} WHERE ${conditions.join(' AND ')}`;
  const innerSelectParams = [...inner.params, ...params];
  const outer = projectOuterColumn(ctx, outerClause);
  if (outerClause.type === 'in') {
    return {
      sql: `(${outer.sqlExpr} IN (${innerSelect}))`,
      params: [...outer.baseParams, ...innerSelectParams],
    };
  }
  // 3-valued NOT IN: a NULL on the LHS would otherwise yield UNKNOWN and
  // exclude the row. We want NULLs to *match* `not_in` (i.e. be returned).
  const nullSafeParams: unknown[] = [...outer.baseParams];
  if (outer.isJsonb && outer.jsonbKey !== null) {
    nullSafeParams.push(outer.jsonbKey);
  }
  return {
    sql: `(${outer.sqlExpr} IS NULL OR ${outer.sqlExpr} NOT IN (${innerSelect}))`,
    params: [...nullSafeParams, ...innerSelectParams],
  };
}

function buildSetClause(clause: SetClause, ctx: WhereCtx): WhereFragment {
  if (isSubqueryRef(clause.values)) {
    return buildSubqueryRhs(clause, clause.values, ctx);
  }
  return buildSetClauseLiteral(clause, ctx, clause.values);
}

function buildExistenceClause(
  clause: ExistenceClause,
  ctx: WhereCtx
): WhereFragment {
  const ref = resolveAttributeColumn(ctx, clause.attribute);
  if (ref.kind === 'generated') {
    const op = clause.type === 'exists' ? 'IS NOT NULL' : 'IS NULL';
    return { sql: `(${ref.sqlExpr} ${op})`, params: [] };
  }
  const col = `${ref.jsonColumn}::jsonb`;
  const key = topLevelJsonKey(ref.attribute);
  const op = clause.type === 'exists' ? 'IS NOT NULL' : 'IS NULL';
  return {
    sql: `(${col} -> ?) ${op}`,
    params: [key],
  };
}

function buildAndOrClause(clause: AndOrClause, ctx: WhereCtx): WhereFragment {
  assert.ok(
    Array.isArray(clause.clauses) && clause.clauses.length > 0,
    `Empty clauses list for ${clause.type} clause would produce invalid SQL "()"`,
    { clause }
  );
  const parts = clause.clauses.map((c) => buildWhereClauseInCtx(c, ctx));
  const sep = clause.type === 'and' ? ' AND ' : ' OR ';
  return {
    sql: `(${parts.map((p) => p.sql).join(sep)})`,
    params: parts.flatMap((p) => p.params),
  };
}

function buildNotClause(clause: NotClause, ctx: WhereCtx): WhereFragment {
  const inner = buildWhereClauseInCtx(clause.clause, ctx);
  return { sql: `NOT (${inner.sql})`, params: inner.params };
}

type ClauseBuilder = (
  clause: PatchDbQueryWhereClause,
  ctx: WhereCtx
) => WhereFragment;

const CLAUSE_BUILDERS: Record<PatchDbQueryWhereClause['type'], ClauseBuilder> =
  {
    '=': (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    '!=': (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    gt: (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    gte: (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    lt: (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    lte: (c, ctx) => buildBinaryClause(c as BinaryClause, ctx),
    contains: (c, ctx) => buildContainsClause(c as ContainsClause, ctx),
    in: (c, ctx) => buildSetClause(c as SetClause, ctx),
    not_in: (c, ctx) => buildSetClause(c as SetClause, ctx),
    exists: (c, ctx) => buildExistenceClause(c as ExistenceClause, ctx),
    not_exists: (c, ctx) => buildExistenceClause(c as ExistenceClause, ctx),
    and: (c, ctx) => buildAndOrClause(c as AndOrClause, ctx),
    or: (c, ctx) => buildAndOrClause(c as AndOrClause, ctx),
    not: (c, ctx) => buildNotClause(c as NotClause, ctx),
  };

const ALWAYS_FALSE: WhereFragment = { sql: '(1 = 0)', params: [] };
const ALWAYS_TRUE: WhereFragment = { sql: '(1 = 1)', params: [] };

function isEmptyArrayValues(clause: PatchDbQueryWhereClause): boolean {
  if (clause.type !== 'in' && clause.type !== 'not_in') return false;
  return Array.isArray(clause.values) && clause.values.length === 0;
}

function trivialFragmentForEmptyCollection(
  clause: PatchDbQueryWhereClause
): WhereFragment | null {
  if (isEmptyArrayValues(clause)) {
    return clause.type === 'in' ? ALWAYS_FALSE : ALWAYS_TRUE;
  }
  if (clause.type === 'and' && clause.clauses.length === 0) return ALWAYS_TRUE;
  if (clause.type === 'or' && clause.clauses.length === 0) return ALWAYS_FALSE;
  return null;
}

export function buildWhereClauseInCtx(
  clause: PatchDbQueryWhereClause,
  ctx: WhereCtx
): WhereFragment {
  const trivial = trivialFragmentForEmptyCollection(clause);
  if (trivial !== null) return trivial;
  const builder = CLAUSE_BUILDERS[clause.type];
  assert.defined(builder, 'Invalid where clause type');
  const fragment = builder(clause, ctx);
  assertWhereFragment(fragment, {
    clauseType: clause.type,
    jsonColumn: ctx.jsonColumn,
  });
  return fragment;
}

export function buildWhereClauseForColumn(
  clause: PatchDbQueryWhereClause,
  ctx: WhereCtx
): WhereFragment {
  return buildWhereClauseInCtx(clause, ctx);
}
