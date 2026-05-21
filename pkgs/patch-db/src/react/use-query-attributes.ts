import type { Keyword } from '@pkgs/keyword';
import { useMemo } from 'react';
import type {
  PatchDbQuery,
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
  PatchEntityType,
} from '../interface';
import { useQuery } from './use-query';

/**
 * Returns a list of parsed attribute values for every entity matching a query.
 */
export function useQueryAttributes<T>(args: {
  entityType: PatchEntityType;
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  limit?: number;
  attributeKey: Keyword;
  parse: (raw: unknown) => T;
}): T[] {
  const { entityType, where, orderBy, limit, attributeKey, parse } = args;
  const query: PatchDbQuery = { entityType };
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  if (limit !== undefined) query.limit = limit;
  const result = useQuery(query);
  const entities = result.entities;
  return useMemo(
    () => entities.map((e) => parse(e.attributes[attributeKey])),
    [entities, attributeKey, parse]
  );
}
