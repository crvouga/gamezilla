import { useMemo } from 'react';
import type {
  PatchDbQuery,
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
} from '../interface';
import { useQuery } from './use-query';

/**
 * Reads a single attribute from a single entity matching a query.
 *
 * `parse` receives the raw stored value (or `undefined` when no entity matched /
 * the attribute is absent). Typically pass the same `parse` as your domain attribute tag.
 */
export function useQueryAttribute<T>(args: {
  entityType: string;
  entityId?: string | string[];
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  attributeKey: string;
  parse: (raw: unknown) => T;
}): T {
  const { entityType, entityId, where, orderBy, attributeKey, parse } = args;
  const query: PatchDbQuery = { entityType, limit: 1 };
  if (entityId !== undefined) query.entityId = entityId;
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  const result = useQuery(query);
  const raw = result.entities[0]?.attributes[attributeKey];
  return useMemo((): T => parse(raw), [raw, parse]);
}
