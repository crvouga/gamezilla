import { useCallback, useRef } from 'react';
import type { Entity } from '@pkgs/patch-db/interface';

/**
 * Simplified reorder helper for React Native.
 * Instead of drag-and-drop (which requires gesture-handler), provides
 * move-up / move-down callbacks per index.
 */
export function useReorder(
  entities: Entity[],
  onReorder: (entityIds: string[]) => void
) {
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const moveUp = useCallback((index: number) => {
    const ents = entitiesRef.current;
    if (index <= 0) return;
    const reordered = [...ents];
    const item = reordered[index];
    if (!item) return;
    reordered.splice(index, 1);
    reordered.splice(index - 1, 0, item);
    onReorderRef.current(reordered.map((x) => x.entityId));
  }, []);

  const moveDown = useCallback((index: number) => {
    const ents = entitiesRef.current;
    if (index >= ents.length - 1) return;
    const reordered = [...ents];
    const item = reordered[index];
    if (!item) return;
    reordered.splice(index, 1);
    reordered.splice(index + 1, 0, item);
    onReorderRef.current(reordered.map((x) => x.entityId));
  }, []);

  return { moveUp, moveDown } as const;
}
