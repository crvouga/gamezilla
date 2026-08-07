import type { LiveShape } from '../api';

export function ShapeItem(props: {
  readonly shape: LiveShape;
  readonly readonly?: boolean;
  readonly dragging?: boolean;
  readonly dragOver?: boolean;
  readonly onDragStart?: (id: string) => void;
  readonly onDragOver?: (id: string) => void;
  readonly onDrop?: (id: string) => void;
  readonly onDragEnd?: () => void;
  readonly onRemove?: (id: string) => void;
}) {
  const { shape } = props;
  return (
    <li
      data-shape-id={shape.id}
      className={[
        'shape-item',
        props.readonly === true ? 'readonly' : '',
        props.dragging === true ? 'dragging' : '',
        props.dragOver === true ? 'drag-over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={props.readonly !== true}
      onDragStart={() => props.onDragStart?.(shape.id)}
      onDragOver={(e) => {
        if (props.readonly === true) return;
        e.preventDefault();
        props.onDragOver?.(shape.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop?.(shape.id);
      }}
      onDragEnd={() => props.onDragEnd?.()}
    >
      <span className={`shape-glyph ${shape.kind}`} aria-hidden />
      <span className="shape-meta">
        <span className="shape-kind">{shape.kind}</span>
        <span className="shape-id">{shape.id}</span>
      </span>
      {props.readonly !== true && props.onRemove !== undefined ? (
        <button
          type="button"
          onClick={() => props.onRemove?.(shape.id)}
          title="Remove"
        >
          ×
        </button>
      ) : null}
    </li>
  );
}
