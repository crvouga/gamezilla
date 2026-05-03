import type { Entity, PatchDbQuery } from '../interface';
import { useQuery } from './use-query';

export function useQueryOne(query: PatchDbQuery): Entity | null {
  const entities = useQuery(query);
  const first = entities.entities[0];
  return first ?? null;
}
