import { assert } from '../../assert';
import type { PatchesDbQuery, PatchesDbQueryWhereClause } from '../interface';
import { assertAttribute } from '../interface';

export type WhereFragment = { sql: string; params: unknown[] };

/** Builds JSON path for keys; uses quoted form for keys with . / [ ] */
function jsonPathForAttribute(attribute: string): string {
  return /[./[\]]/.test(attribute)
    ? `$."${attribute.replace(/"/g, '""')}"`
    : `$.${attribute}`;
}

function buildWhereClauseForColumn(
  clause: PatchesDbQueryWhereClause,
  jsonColumn: string
): WhereFragment {
  switch (clause.type) {
    case '=': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) = ?`,
        params: [path, clause.value],
      };
    }
    case '!=': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) != ?`,
        params: [path, clause.value],
      };
    }
    case 'gt': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) > ?`,
        params: [path, clause.value],
      };
    }
    case 'gte': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) >= ?`,
        params: [path, clause.value],
      };
    }
    case 'lt': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) < ?`,
        params: [path, clause.value],
      };
    }
    case 'lte': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) <= ?`,
        params: [path, clause.value],
      };
    }
    case 'contains': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) LIKE '%' || ? || '%'`,
        params: [path, clause.value],
      };
    }
    case 'in': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      const placeholders = clause.values.map(() => '?').join(', ');
      return {
        sql: `json_extract(${jsonColumn}, ?) IN (${placeholders})`,
        params: [path, ...clause.values],
      };
    }
    case 'not_in': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      const placeholders = clause.values.map(() => '?').join(', ');
      return {
        sql: `json_extract(${jsonColumn}, ?) NOT IN (${placeholders})`,
        params: [path, ...clause.values],
      };
    }
    case 'exists': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) IS NOT NULL`,
        params: [path],
      };
    }
    case 'not_exists': {
      const path = jsonPathForAttribute(assertAttribute(clause.attribute));
      return {
        sql: `json_extract(${jsonColumn}, ?) IS NULL`,
        params: [path],
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
      const _exhaustive: never = clause;
      assert(false, 'Unhandled where clause type', { clause: _exhaustive });
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
    return (
      'ORDER BY ' +
      query.orderBy
        .map((o) => {
          const path = jsonPathForAttribute(assertAttribute(o.attribute));
          const dir = o.direction === 'desc' ? 'DESC' : 'ASC';
          return `json_extract(${attributePrefix}attributes, '${path.replace(/'/g, "''")}') ${dir}`;
        })
        .join(', ')
    );
  }
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
  return { sql, params };
}
