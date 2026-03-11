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
  if (!db) {
    throw new Error('PatchesDb not found');
  }
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
    const parsedQuery = JSON.parse(queryKey) as PatchesDbQuery;
    const unsubscribe = db.subscribe.entities(parsedQuery, setResult);
    return unsubscribe;
  }, [db, queryKey]);
  return result;
}

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  return entities.entities.length > 0 ? entities.entities[0] : null;
}
