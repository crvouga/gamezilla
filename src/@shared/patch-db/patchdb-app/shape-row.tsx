import type { DragEvent as ReactDragEvent } from 'react';
import type { Entity } from '../interface';
import { SHAPE_ATTR } from '../sim/playground-shapes';
import { IconGrip } from './icons';
import { btnTiny } from './styles';

export function ShapeRow({
  entity,
  index,
  busy,
  onRandomize,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  entity: Entity;
  index: number;
  busy: boolean;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onDragStart: (e: ReactDragEvent, index: number) => void;
  onDragOver: (e: ReactDragEvent, index: number) => void;
  onDrop: (e: ReactDragEvent, index: number) => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className="group flex items-center gap-1.5 rounded-lg border border-transparent px-1 py-0.5 transition-colors hover:border-white/10 hover:bg-white/5"
    >
      <span className="cursor-grab text-white/25 active:cursor-grabbing">
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
