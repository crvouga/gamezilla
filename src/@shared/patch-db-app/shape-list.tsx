import type { DragEvent as ReactDragEvent } from 'react';
import type { Entity } from '../patch-db/interface';
import { IconPlus } from './icons';
import { ShapeRow } from './shape-row';
import { btnAction } from './styles';

export function ShapeList({
  entities,
  busy,
  note,
  onRandomize,
  onDelete,
  onCreate,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  entities: Entity[];
  busy: boolean;
  note?: string | null;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onCreate: () => void;
  onDragStart: (e: ReactDragEvent, index: number) => void;
  onDragOver: (e: ReactDragEvent, index: number) => void;
  onDrop: (e: ReactDragEvent, index: number) => void;
}) {
  return (
    <>
      {entities.length === 0 ? (
        <p className="py-2 text-center text-[0.7rem] text-white/30">
          No shapes
        </p>
      ) : (
        <ol className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-1 text-[0.72rem]">
          {entities.map((e, i) => (
            <ShapeRow
              key={e.entityId}
              entity={e}
              index={i}
              busy={busy}
              onRandomize={onRandomize}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
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
