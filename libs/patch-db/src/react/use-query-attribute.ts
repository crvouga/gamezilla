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
 * The parser (`attributeValue`) receives the raw stored value (or `undefined`
 * when no entity matched / the attribute is absent) and decides the default.
 *
 * Two atoms reading two attributes from the same entity collapse to one
 * underlying subscription because the cache is keyed on the full query shape:
 * passing the same `entityType` + `entityId` produces the same `JSON.stringify`
 * key, so the cache fans listeners over a single SQL subscription.
 *
 * Field naming: `attributeKey` is the attribute name string and
 * `attributeValue` is the parser function that produces the typed value.
 * The slight asymmetry (`attributeValue` is a function) is intentional — the
 * parser turns the raw stored value into the materialized typed value.
 */
export function useQueryAttribute<T>(args: {
  entityType: string;
  entityId?: string | string[];
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  attributeKey: string;
  attributeValue: (raw: unknown) => T;
}): T {
  const { entityType, entityId, where, orderBy, attributeKey, attributeValue } =
    args;
  const query: PatchDbQuery = { entityType, limit: 1 };
  if (entityId !== undefined) query.entityId = entityId;
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  const result = useQuery(query);
  const raw = result.entities[0]?.attributes[attributeKey];
  return useMemo(
    () => attributeValue(raw),
    // attributeValue is intentionally re-invoked when raw changes; consumers
    // usually pass a stable parser. Memoizing on raw keeps referential
    // stability for object-returning parsers across unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw]
  );
}
