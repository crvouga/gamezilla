import type { Keyword } from '@gamezilla/keyword';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  PatchDbQueryOrderBy,
  PatchDbQueryWhereClause,
  PatchEntityType,
} from '../interface';
import type { PatchDbEntityStore } from './entity-store';
import { getEntityStoreForDb } from './entity-store';
import { usePatchDb } from './patch-db-context';
import {
  buildQueryAttributeDescriptor,
  type QueryAttributeDescriptor,
} from './query-attribute-descriptor';
import type { PatchDbQueryCache } from './query-cache';
import { getCacheForDb } from './query-cache';

function descriptorFromShapeKey(shapeKey: string): QueryAttributeDescriptor {
  const parsed = JSON.parse(shapeKey) as {
    entityType: PatchEntityType;
    entityId?: string | string[];
    where?: PatchDbQueryWhereClause;
    orderBy?: PatchDbQueryOrderBy[];
  };
  return buildQueryAttributeDescriptor({
    entityType: parsed.entityType,
    ...(parsed.entityId !== undefined ? { entityId: parsed.entityId } : {}),
    ...(parsed.where !== undefined ? { where: parsed.where } : {}),
    ...(parsed.orderBy !== undefined ? { orderBy: parsed.orderBy } : {}),
  });
}

type ParseCache<T> = {
  readonly shapeAttr: string;
  readonly raw: unknown;
  readonly value: T;
  readonly parseFn: (raw: unknown) => T;
};

function readRawForQueryAttribute(
  desc: QueryAttributeDescriptor,
  attributeKey: Keyword,
  entityStore: PatchDbEntityStore,
  queryCache: PatchDbQueryCache
): unknown {
  if (desc.kind === 'entity') {
    const existing = entityStore.getResult(desc.entityType, desc.entityId);
    const snap =
      existing ?? entityStore.getOrCreateResult(desc.entityType, desc.entityId);
    return snap.entity?.attributes[attributeKey];
  }
  const existing = queryCache.getResult(desc.queryKey);
  const r = existing ?? queryCache.getOrCreateResult(desc.queryKey, desc.query);
  return r.entities[0]?.attributes[attributeKey];
}

/**
 * Structural match for `@gamezilla/attribute` `AttributeTag` — only `key` and
 * `parse` are required for {@link useQueryAttribute}.
 */
export type QueryAttributeLike<T = unknown> = {
  key: Keyword;
  parse: (raw: unknown) => T;
};

function reuseOrParse<T>(
  cacheRef: { current: ParseCache<T> | null },
  shapeAttr: string,
  raw: unknown,
  parse: (raw: unknown) => T
): T {
  const c = cacheRef.current;
  if (
    c !== null &&
    c.shapeAttr === shapeAttr &&
    c.parseFn === parse &&
    Object.is(c.raw, raw)
  ) {
    return c.value;
  }
  const value = parse(raw);
  cacheRef.current = { shapeAttr, raw, value, parseFn: parse };
  return value;
}

/**
 * Reads a single attribute from a single entity matching a query.
 *
 * When `entityId` is a single string and there is no `where` / `orderBy`,
 * shares one underlying subscription per `(entityType, entityId)` with other
 * attribute hooks. Otherwise falls back to the predicate query cache.
 *
 * `attribute.parse` receives the raw stored value (or `undefined` when no entity matched /
 * the attribute is absent). Pass an attribute tag (e.g. `TodoAttr.title`).
 */
export function useQueryAttribute<T>(args: {
  entityType: PatchEntityType;
  entityId?: string | string[];
  where?: PatchDbQueryWhereClause;
  orderBy?: PatchDbQueryOrderBy[];
  attribute: QueryAttributeLike<T>;
}): T {
  const db = usePatchDb();
  const entityStore = useMemo(() => getEntityStoreForDb(db), [db]);
  const queryCache = useMemo(() => getCacheForDb(db), [db]);

  const { entityType, entityId, where, orderBy, attribute } = args;
  const attributeKey = attribute.key;
  const parse = attribute.parse;

  /** Serialize shape so inline `where` / `orderBy` objects do not churn `desc` every render (would break `useSyncExternalStore`). */
  const shapeKey = JSON.stringify({
    entityType,
    entityId,
    where,
    orderBy,
  });
  const desc = useMemo(() => descriptorFromShapeKey(shapeKey), [shapeKey]);
  const parseCacheRef = useRef<ParseCache<T> | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (desc.kind === 'entity') {
        return entityStore.subscribe(desc.entityType, desc.entityId, listener);
      }
      return queryCache.subscribe(desc.queryKey, desc.query, listener);
    },
    [entityStore, queryCache, desc]
  );

  const getSnapshot = useCallback((): T => {
    const raw = readRawForQueryAttribute(
      desc,
      attributeKey,
      entityStore,
      queryCache
    );
    return reuseOrParse(
      parseCacheRef,
      `${shapeKey}\0${attributeKey}`,
      raw,
      parse
    );
  }, [entityStore, queryCache, desc, attributeKey, parse, shapeKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
