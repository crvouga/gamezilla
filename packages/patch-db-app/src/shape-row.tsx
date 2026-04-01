import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Entity } from '@gamezilla/patch-db/interface';
import { SHAPE_ATTR } from '@gamezilla/patch-db/sim/playground-shapes';
import { IconGrip } from './icons';
import { btnTiny } from './styles';
import type { DragState } from './use-drag-reorder';

export function ShapeRow({
  entity,
  index,
  busy,
  dragState,
  onRandomize,
  onDelete,
  onGripPointerDown,
}: {
  entity: Entity;
  index: number;
  busy: boolean;
  dragState: DragState | null;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onGripPointerDown: (e: ReactPointerEvent, index: number) => void;
}) {
  const isDragging = dragState?.fromIdx === index;
  const isDropTarget =
    dragState !== null &&
    dragState.overIdx === index &&
    dragState.fromIdx !== index;

  return (
    <li
      className={`group flex items-center gap-1.5 rounded-lg border px-1 py-0.5 transition-all duration-150 ${
        isDragging
          ? 'border-transparent opacity-30'
          : isDropTarget
            ? 'border-teal-400/40 bg-teal-500/10'
            : 'border-transparent hover:border-white/10 hover:bg-white/5'
      }`}
    >
      <span
        className="cursor-grab text-white/25 active:cursor-grabbing touch-none select-none"
        onPointerDown={(e) => onGripPointerDown(e, index)}
      >
        <IconGrip />
      </span>
      <span className="w-5 shrink-0 text-center text-[0.6rem] text-white/35 font-mono">
        {String(entity.attributes[SHAPE_ATTR.order] ?? index)}
      </span>
      <svg
        viewBox="0 0 100 100"
        className="h-6 w-6 shrink-0 rounded border border-white/10 bg-black/40"
      >
        <polygon
          points={String(entity.attributes[SHAPE_ATTR.points] ?? '')}
          fill={String(entity.attributes[SHAPE_ATTR.fill] ?? '#666')}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={0.5}
          className="transition-[fill] duration-300"
        />
      </svg>
      <span className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-white/65">
        {String(entity.attributes[SHAPE_ATTR.kind] ?? '')}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRandomize(entity.entityId)}
        className={btnTiny}
      >
        Rand
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDelete(entity.entityId)}
        className={`${btnTiny} hover:text-red-400`}
      >
        Del
      </button>
    </li>
  );
}
