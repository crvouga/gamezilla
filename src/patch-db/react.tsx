import { assert } from '@/@shared/assert';
import { InjectionToken } from '@/@shared/dependency-injection/dependency-injection-container';
import { useDependency } from '@/@shared/dependency-injection/react';
import { useEffect, useState } from 'react';
import {
  Entity,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
} from './interface';
import { SubscribablePatchesDbToken } from './subscribable';

export const PatchesDbToken: InjectionToken<PatchesDb> = Symbol('PatchesDb');

export function usePatchesDb(): PatchesDb {
  const db = useDependency(PatchesDbToken);
  assert.defined(db, 'PatchesDb not found');
  return db;
}

export function useEntities(query: PatchesDbQuery): PatchesDbResult {
  const db = useDependency(SubscribablePatchesDbToken);
  const [result, setResult] = useState<PatchesDbResult>(() => ({
    query,
    entities: [],
    patches: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
  }));
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    const parsed: unknown = JSON.parse(queryKey);
    assert.ok(
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      'queryKey must roundtrip to object (from JSON.stringify of PatchesDbQuery)',
      { queryKey }
    );
    const parsedQuery = parsed as PatchesDbQuery;
    const unsubscribe = db.subscribe.entities(parsedQuery, setResult);
    return unsubscribe;
  }, [db, queryKey]);
  return result;
}

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  const first = entities.entities[0];
  return first ?? null;
}
