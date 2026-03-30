import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { Entity } from '../patch-db/interface';

export type DragState = {
  fromIdx: number;
  overIdx: number;
};

/**
 * Pointer-event based drag-to-reorder that works on both desktop and mobile.
 * The grip handle fires `onGripPointerDown`; everything else is handled
 * via document-level pointermove/pointerup listeners.
 */
export function useDragReorder(
  entities: Entity[],
  onReorder: (entityIds: string[]) => void
) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const overIdxRef = useRef<number | null>(null);

  const handleGripPointerDown = useCallback(
    (e: ReactPointerEvent, idx: number) => {
      e.preventDefault();
      e.stopPropagation();
      overIdxRef.current = idx;
      setDragState({ fromIdx: idx, overIdx: idx });

      const findOverIdx = (clientY: number): number => {
        if (!listRef.current) return idx;
        const children = listRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i]!.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (clientY < midY) return i;
        }
        return children.length - 1;
      };

      const handleMove = (ev: PointerEvent) => {
        const next = findOverIdx(ev.clientY);
        if (next !== overIdxRef.current) {
          overIdxRef.current = next;
          setDragState({ fromIdx: idx, overIdx: next });
        }
      };

      const handleUp = () => {
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.removeEventListener('pointercancel', handleUp);
        const over = overIdxRef.current;
        const ents = entitiesRef.current;
        if (over !== null && idx !== over) {
          const reordered = [...ents];
          const [moved] = reordered.splice(idx, 1);
          if (moved) {
            reordered.splice(over, 0, moved);
            onReorderRef.current(reordered.map((x) => x.entityId));
          }
        }
        setDragState(null);
        overIdxRef.current = null;
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      document.addEventListener('pointercancel', handleUp);
    },
    []
  );

  return { listRef, dragState, handleGripPointerDown } as const;
}
