import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCallback } from 'react';
import type { Entity } from '../patch-db/interface';
import { IconPlus } from './icons';
import { ShapeRow } from './shape-row';
import { btnAction } from './styles';
import { useDragReorder } from './use-drag-reorder';

export function ShapeList({
  entities,
  busy,
  note,
  onRandomize,
  onDelete,
  onCreate,
  onReorder,
}: {
  entities: Entity[];
  busy: boolean;
  note?: string | null;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onCreate: () => void;
  onReorder: (entityIds: string[]) => void;
}) {
  const [animateRef] = useAutoAnimate({ duration: 200 });
  const { listRef, dragState, handleGripPointerDown } = useDragReorder(
    entities,
    onReorder
  );

  const mergedRef = useCallback(
    (node: HTMLOListElement | null) => {
      if (typeof animateRef === 'function') animateRef(node);
      listRef.current = node;
    },
    [animateRef, listRef]
  );

  return (
    <>
      {entities.length === 0 ? (
        <p className="py-2 text-center text-[0.7rem] text-white/30">
          No shapes
        </p>
      ) : (
        <ol
          ref={mergedRef}
          className="max-h-48 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 text-[0.72rem]"
        >
          {entities.map((e, i) => (
            <ShapeRow
              key={e.entityId}
              entity={e}
              index={i}
              busy={busy}
              dragState={dragState}
              onRandomize={onRandomize}
              onDelete={onDelete}
              onGripPointerDown={handleGripPointerDown}
            />
          ))}
        </ol>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onCreate}
        className={`${btnAction} mt-2 w-full justify-center`}
      >
        <IconPlus size={14} />
        Create shape
      </button>

      {note ? (
        <p className="mt-1.5 text-[0.7rem] text-amber-300">{note}</p>
      ) : null}
    </>
  );
}
