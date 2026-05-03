import type { Entity, PatchesDbQuery } from '../interface';
import { useEntities } from './use-entities';

export function useEntity(query: PatchesDbQuery): Entity | null {
  const entities = useEntities(query);
  const first = entities.entities[0];
  return first ?? null;
}
