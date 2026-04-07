import { assert } from '@gamezilla/shared/assert';
import {
  assertOffsetLimitFragment,
  assertOrderByFragment,
} from '@gamezilla/shared/sqlite';
import type { PatchesDbQuery, PatchesDbQueryWhereClause } from '../interface';
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
  if (v == null) return String(v);
  return String(v);
}

/** Builds JSON path for keys; uses same quoting rules as SQLite query-builder */
function jsonPathForAttribute(attribute: string): string {
  assertAttribute(attribute);
  return /[./[\]]/.test(attribute)
    ? `$."${attribute.replace(/"/g, '""')}"`
    : `$.${attribute}`;
}

function buildWhereClauseForColumn(
  clause: PatchesDbQueryWhereClause,
  jsonColumn: string
): WhereFragment {
  const col = `${jsonColumn}::jsonb`;
  switch (clause.type) {
    case '=': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) = ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case '!=': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) IS DISTINCT FROM ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'gt': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) > ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'gte': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) >= ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'lt': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) < ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'lte': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) <= ?::text`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'contains': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} ->> ?) LIKE '%' || ?::text || '%'`,
        params: [key, toTextParam(clause.value)],
      };
    }
    case 'in': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      const placeholders = clause.values.map(() => '?::text').join(', ');
      return {
        sql: `(${col} ->> ?) IN (${placeholders})`,
        params: [key, ...clause.values.map(toTextParam)],
      };
    }
    case 'not_in': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      const placeholders = clause.values.map(() => '?::text').join(', ');
      return {
        sql: `((${col} ->> ?) IS NULL OR (${col} ->> ?) NOT IN (${placeholders}))`,
        params: [key, key, ...clause.values.map(toTextParam)],
      };
    }
    case 'exists': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} -> ?) IS NOT NULL`,
        params: [key],
      };
    }
    case 'not_exists': {
      assertAttribute(clause.attribute);
      const path = jsonPathForAttribute(clause.attribute);
      const key = sqliteJsonPathToKey(path);
      return {
        sql: `(${col} -> ?) IS NULL`,
        params: [key],
      };
    }
    case 'and': {
      const parts = clause.clauses.map((c) =>
        buildWhereClauseForColumn(c, jsonColumn)
      );
      return {
        sql: `(${parts.map((p) => p.sql).join(' AND ')})`,
        params: parts.flatMap((p) => p.params),
      };
    }
    case 'or': {
      const parts = clause.clauses.map((c) =>
        buildWhereClauseForColumn(c, jsonColumn)
      );
      return {
        sql: `(${parts.map((p) => p.sql).join(' OR ')})`,
        params: parts.flatMap((p) => p.params),
      };
    }
    case 'not': {
      const inner = buildWhereClauseForColumn(clause.clause, jsonColumn);
      return { sql: `NOT (${inner.sql})`, params: inner.params };
    }
    default: {
      assert.fail('Invalid where clause type', { clause });
    }
  }
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
