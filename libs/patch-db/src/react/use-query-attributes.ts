import { useMemo } from 'react';
import type {
  PatchDbQuery,
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
} from '../interface';
import { useQuery } from './use-query';

/**
 * Returns a list of parsed attribute values for every entity matching a query.
 *
 * Each entity contributes one parsed value (`attributeValue(rawAttribute)`).
 * Use for narrow aggregations like "the `expiresAt` of every active session
 * for this device" — anywhere a per-entity scalar list is needed.
 */
export function useQueryAttributes<T>(args: {
  entityType: string;
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  limit?: number;
  attributeKey: string;
  attributeValue: (raw: unknown) => T;
}): T[] {
  const { entityType, where, orderBy, limit, attributeKey, attributeValue } =
    args;
  const query: PatchDbQuery = { entityType };
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  if (limit !== undefined) query.limit = limit;
  const result = useQuery(query);
  const entities = result.entities;
  return useMemo(
    () => entities.map((e) => attributeValue(e.attributes[attributeKey])),
    // Parser is assumed stable; re-run whenever entities or the attributeKey
    // change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, attributeKey]
  );
}
