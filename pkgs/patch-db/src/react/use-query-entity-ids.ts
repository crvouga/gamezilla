import { useMemo } from 'react';
import type {
  PatchDbQuery,
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
} from '../interface';
import { useQuery } from './use-query';

/**
 * Returns the entity ids matching a query, memoized for a stable reference.
 *
 * Use wherever a parent needs to iterate ids and render an atom per id.
 * Atoms then call `useQueryAttribute` against the same entity to read the
 * specific attribute they render. The cache fans them in over the single
 * underlying subscription created by this hook.
 */
export function useQueryEntityIds(args: {
  entityType: string;
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  limit?: number;
}): string[] {
  const { entityType, where, orderBy, limit } = args;
  const query: PatchDbQuery = { entityType };
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  if (limit !== undefined) query.limit = limit;
  const result = useQuery(query);
  const entities = result.entities;
  return useMemo(() => entities.map((e) => e.entityId), [entities]);
}
