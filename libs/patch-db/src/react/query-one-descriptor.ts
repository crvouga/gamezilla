import type { PatchDbQuery } from '../interface';

export type QueryOneDescriptor =
  | { kind: 'entity'; entityType: string; entityId: string }
  | { kind: 'query'; queryKey: string; query: PatchDbQuery };

function hasSingleEntityKeys(query: PatchDbQuery): boolean {
  return (
    typeof query.entityId === 'string' &&
    query.entityType !== undefined &&
    query.entityType !== ''
  );
}

function hasNoQueryShapeModifiers(query: PatchDbQuery): boolean {
  if (query.where !== undefined) return false;
  if (query.orderBy !== undefined) return false;
  if (query.limit !== undefined && query.limit !== 1) return false;
  if (query.after !== undefined && query.after !== null) return false;
  return query.on === undefined;
}

function trySimpleEntityOneDescriptor(
  query: PatchDbQuery
): QueryOneDescriptor | undefined {
  if (!hasSingleEntityKeys(query) || !hasNoQueryShapeModifiers(query)) {
    return undefined;
  }
  return {
    kind: 'entity',
    entityType: query.entityType!,
    entityId: query.entityId as string,
  };
}

export function buildQueryOneDescriptor(
  query: PatchDbQuery
): QueryOneDescriptor {
  const entity = trySimpleEntityOneDescriptor(query);
  if (entity !== undefined) return entity;
  return { kind: 'query', queryKey: JSON.stringify(query), query };
}
