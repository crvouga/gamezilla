import type {
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
  PatchesDbQueryWhereSource,
} from '../interface';

export type WhereFragment = { sql: string; params: unknown[] };

function clauseMatchesSource(
  clause: PatchesDbQueryWhereClause,
  source: PatchesDbQueryWhereSource
): boolean {
  if ('attribute' in clause) {
    const clauseSource = clause.source ?? 'attributes';
    return clauseSource === source;
  }
  return false;
}

/** Extracts the sub-tree of clauses matching the given source (attributes or metadata). */
export function extractClausesBySource(
  clause: PatchesDbQueryWhereClause,
  source: PatchesDbQueryWhereSource
): PatchesDbQueryWhereClause | null {
  if (clauseMatchesSource(clause, source)) {
    return clause;
  }
  if (clause.type === 'and') {
    const extracted = clause.clauses
      .map((c) => extractClausesBySource(c, source))
      .filter((c): c is PatchesDbQueryWhereClause => c != null);
    if (extracted.length === 0) return null;
    if (extracted.length === 1) return extracted[0];
    return { type: 'and', clauses: extracted };
  }
  if (clause.type === 'or') {
    const extracted = clause.clauses
      .map((c) => extractClausesBySource(c, source))
      .filter((c): c is PatchesDbQueryWhereClause => c != null);
    if (extracted.length === 0) return null;
    if (extracted.length === 1) return extracted[0];
    return { type: 'or', clauses: extracted };
  }
  if (clause.type === 'not') {
    const inner = extractClausesBySource(clause.clause, source);
    if (inner == null) return null;
    return { type: 'not', clause: inner };
  }
  return null;
}

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

export function buildMetadataWhereClause(
  clause: PatchesDbQueryWhereClause,
  columnPrefix = ''
): WhereFragment {
  const jsonColumn = `${columnPrefix}metadata`;
  const build = (c: PatchesDbQueryWhereClause): WhereFragment => {
    switch (c.type) {
      case '=':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) = ?`,
          params: [c.attribute, c.value],
        };
      case '!=':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) != ?`,
          params: [c.attribute, c.value],
        };
      case 'gt':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) > ?`,
          params: [c.attribute, c.value],
        };
      case 'gte':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) >= ?`,
          params: [c.attribute, c.value],
        };
      case 'lt':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) < ?`,
          params: [c.attribute, c.value],
        };
      case 'lte':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) <= ?`,
          params: [c.attribute, c.value],
        };
      case 'contains':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) LIKE '%' || ? || '%'`,
          params: [c.attribute, c.value],
        };
      case 'in': {
        const placeholders = c.values.map(() => '?').join(', ');
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) IN (${placeholders})`,
          params: [c.attribute, ...c.values],
        };
      }
      case 'not_in': {
        const placeholders = c.values.map(() => '?').join(', ');
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) NOT IN (${placeholders})`,
          params: [c.attribute, ...c.values],
        };
      }
      case 'exists':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) IS NOT NULL`,
          params: [c.attribute],
        };
      case 'not_exists':
        return {
          sql: `json_extract(${jsonColumn}, '$.' || ?) IS NULL`,
          params: [c.attribute],
        };
      case 'and': {
        const parts = c.clauses.map(build);
        return {
          sql: `(${parts.map((p) => p.sql).join(' AND ')})`,
          params: parts.flatMap((p) => p.params),
        };
      }
      case 'or': {
        const parts = c.clauses.map(build);
        return {
          sql: `(${parts.map((p) => p.sql).join(' OR ')})`,
          params: parts.flatMap((p) => p.params),
        };
      }
      case 'not': {
        const inner = build(c.clause);
        return { sql: `NOT (${inner.sql})`, params: inner.params };
      }
    }
  };
  return build(clause);
}

export function buildSnapshotConditions(query: PatchesDbQuery): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.entityType != null) {
    conditions.push('entity_type = ?');
    params.push(query.entityType);
  }

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
    const attributeWhere = extractClausesBySource(query.where, 'attributes');
    if (attributeWhere != null) {
      const fragment = buildWhereClause(attributeWhere);
      conditions.push(fragment.sql);
      params.push(...fragment.params);
    }
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
