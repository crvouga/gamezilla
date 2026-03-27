import type { DragEvent as ReactDragEvent } from 'react';
import { useCallback, useState } from 'react';
import type { Entity } from '../../../patch-db/interface';

export function useDragReorder(
  entities: Entity[],
  onReorder: (entityIds: string[]) => void
) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (_e: ReactDragEvent, idx: number) => setDragIdx(idx),
    []
  );

  const handleDragOver = useCallback(
    (e: ReactDragEvent, _idx: number) => e.preventDefault(),
    []
  );

  const handleDrop = useCallback(
    (_e: ReactDragEvent, dropIdx: number) => {
      if (dragIdx === null || dragIdx === dropIdx) return;
      const reordered = [...entities];
      const [moved] = reordered.splice(dragIdx, 1);
      if (moved) {
        reordered.splice(dropIdx, 0, moved);
        onReorder(reordered.map((e) => e.entityId));
      }
      setDragIdx(null);
    },
    [dragIdx, entities, onReorder]
  );

  return { handleDragStart, handleDragOver, handleDrop } as const;
}
