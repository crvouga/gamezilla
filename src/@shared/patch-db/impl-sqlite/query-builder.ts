import type { PatchesDbQuery, PatchesDbQueryWhereClause } from '../interface';

export type WhereFragment = { sql: string; params: unknown[] };

export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error(`Invalid attribute name: ${name}`);
  }
  return name;
}

export function buildWhereClause(
  clause: PatchesDbQueryWhereClause
): WhereFragment {
  switch (clause.type) {
    case '=':
      return {
        sql: `json_extract(attributes, '$.' || ?) = ?`,
        params: [clause.attribute, clause.value],
      };
    case '!=':
      return {
        sql: `json_extract(attributes, '$.' || ?) != ?`,
        params: [clause.attribute, clause.value],
      };
    case 'gt':
      return {
        sql: `json_extract(attributes, '$.' || ?) > ?`,
        params: [clause.attribute, clause.value],
      };
    case 'gte':
      return {
        sql: `json_extract(attributes, '$.' || ?) >= ?`,
        params: [clause.attribute, clause.value],
      };
    case 'lt':
      return {
        sql: `json_extract(attributes, '$.' || ?) < ?`,
        params: [clause.attribute, clause.value],
      };
    case 'lte':
      return {
        sql: `json_extract(attributes, '$.' || ?) <= ?`,
        params: [clause.attribute, clause.value],
      };
    case 'contains':
      return {
        sql: `json_extract(attributes, '$.' || ?) LIKE '%' || ? || '%'`,
        params: [clause.attribute, clause.value],
      };
    case 'in': {
      const placeholders = clause.values.map(() => '?').join(', ');
      return {
        sql: `json_extract(attributes, '$.' || ?) IN (${placeholders})`,
        params: [clause.attribute, ...clause.values],
      };
    }
    case 'not_in': {
      const placeholders = clause.values.map(() => '?').join(', ');
      return {
        sql: `json_extract(attributes, '$.' || ?) NOT IN (${placeholders})`,
        params: [clause.attribute, ...clause.values],
      };
    }
    case 'exists':
      return {
        sql: `json_extract(attributes, '$.' || ?) IS NOT NULL`,
        params: [clause.attribute],
      };
    case 'not_exists':
      return {
        sql: `json_extract(attributes, '$.' || ?) IS NULL`,
        params: [clause.attribute],
      };
    case 'and': {
      const parts = clause.clauses.map(buildWhereClause);
      return {
        sql: `(${parts.map((p) => p.sql).join(' AND ')})`,
        params: parts.flatMap((p) => p.params),
      };
    }
    case 'or': {
      const parts = clause.clauses.map(buildWhereClause);
      return {
        sql: `(${parts.map((p) => p.sql).join(' OR ')})`,
        params: parts.flatMap((p) => p.params),
      };
    }
    case 'not': {
      const inner = buildWhereClause(clause.clause);
      return { sql: `NOT (${inner.sql})`, params: inner.params };
    }
  }
}

export function buildSnapshotConditions(query: PatchesDbQuery): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = ['entity_type = ?'];
  const params: unknown[] = [query.entityType];

  if (query.entityId != null) {
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
          const attr = sanitizeIdentifier(o.attribute);
          const dir = o.direction === 'desc' ? 'DESC' : 'ASC';
          return `json_extract(${attributePrefix}attributes, '$.${attr}') ${dir}`;
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
  if (query.limit != null) {
    sql += ' LIMIT ?';
    params.push(query.limit);
  }
  if (query.offset != null) {
    sql += ' OFFSET ?';
    params.push(query.offset);
  }
  return { sql, params };
}
