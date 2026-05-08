import type {
  PatchDbQuery,
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
} from '../interface';

export type QueryAttributeDescriptor =
  | { kind: 'entity'; entityType: string; entityId: string }
  | { kind: 'query'; queryKey: string; query: PatchDbQuery };

export function buildQueryAttributeDescriptor(args: {
  entityType: string;
  entityId?: string | string[];
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
}): QueryAttributeDescriptor {
  const { entityType, entityId, where, orderBy } = args;
  if (
    typeof entityId === 'string' &&
    where === undefined &&
    orderBy === undefined
  ) {
    return { kind: 'entity', entityType, entityId };
  }
  const query: PatchDbQuery = { entityType, limit: 1 };
  if (entityId !== undefined) query.entityId = entityId;
  if (where !== undefined) query.where = where;
  if (orderBy !== undefined) query.orderBy = orderBy;
  return { kind: 'query', queryKey: JSON.stringify(query), query };
}
