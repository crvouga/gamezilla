import { useEffect, useRef, useState } from 'react';

import type { LiveShape } from '../api';
import { ShapeItem } from './shape-item';

function flipAnimate(root: HTMLElement, before: Map<string, DOMRect>): void {
  const nodes = root.querySelectorAll<HTMLElement>('[data-shape-id]');
  for (const node of nodes) {
    const id = node.dataset['shapeId'];
    if (id === undefined) continue;
    const prev = before.get(id);
    if (prev === undefined) {
      node.animate(
        [
          { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 180, easing: 'ease-out' }
      );
      continue;
    }
    const next = node.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    );
  }
}

export function ShapeList(props: {
  readonly shapes: readonly LiveShape[];
  readonly readonly: boolean;
  readonly onReorder?: (orderedIds: readonly string[]) => void;
  readonly onRemove?: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const prevShapes = useRef(props.shapes);

  useEffect(() => {
    const root = listRef.current;
    if (root === null) return;
    const before = new Map<string, DOMRect>();
    for (const s of prevShapes.current) {
      const el = root.querySelector<HTMLElement>(`[data-shape-id="${s.id}"]`);
      if (el !== null) before.set(s.id, el.getBoundingClientRect());
    }
    flipAnimate(root, before);
    prevShapes.current = props.shapes;
  }, [props.shapes]);

  const commitReorder = (targetId: string) => {
    if (dragId === null || dragId === targetId) return;
    const ids = props.shapes.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    props.onReorder?.(next);
    setDragId(null);
    setOverId(null);
  };

  return (
    <ul className="shape-list" ref={listRef}>
      {props.shapes.length === 0 ? (
        <li className="empty">No shapes yet</li>
      ) : (
        props.shapes.map((shape) => (
          <ShapeItem
            key={shape.id}
            shape={shape}
            readonly={props.readonly}
            dragging={dragId === shape.id}
            dragOver={overId === shape.id}
            onDragStart={(id) => setDragId(id)}
            onDragOver={(id) => setOverId(id)}
            onDrop={(id) => commitReorder(id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            {...(props.onRemove !== undefined
              ? { onRemove: props.onRemove }
              : {})}
          />
        ))
      )}
    </ul>
  );
}
