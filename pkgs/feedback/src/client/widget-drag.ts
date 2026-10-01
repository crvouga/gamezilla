import type { FeedbackController } from './controller';

export function widgetPosition(
  position: { x: number; y: number },
  bounds: { width: number; height: number },
  frame: { width: number; height: number }
) {
  return {
    x: Math.max(
      Math.min(0, position.x),
      -Math.max(0, bounds.width - frame.width - 32)
    ),
    y: Math.max(
      Math.min(0, position.y),
      -Math.max(0, bounds.height - frame.height - 48)
    ),
  };
}
export function useWidgetDrag(
  controller: () => FeedbackController,
  host: () => HTMLElement | undefined,
  bounds: () => { width: number; height: number }
) {
  let drag: {
    x: number;
    y: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null = null;
  function move(x: number, y: number) {
    const node = host();
    const win = node?.ownerDocument.defaultView;
    if (!node || !win) return;
    const frame = node.getBoundingClientRect();
    const next = widgetPosition({ x, y }, bounds(), {
      width: frame.width || 440,
      height: frame.height || 500,
    });
    controller().move(next.x, next.y);
  }
  return {
    down(event: PointerEvent) {
      if (event.button !== 0) return;
      const origin = controller().workspace.state().position;
      drag = {
        x: event.clientX,
        y: event.clientY,
        originX: origin.x,
        originY: origin.y,
        pointerId: event.pointerId,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    move(event: PointerEvent) {
      if (drag?.pointerId === event.pointerId)
        move(
          drag.originX + event.clientX - drag.x,
          drag.originY + event.clientY - drag.y
        );
    },
    up() {
      drag = null;
    },
    key(event: KeyboardEvent) {
      const directions: Record<string, readonly [number, number]> = {
        ArrowLeft: [-24, 0],
        ArrowRight: [24, 0],
        ArrowUp: [0, -24],
        ArrowDown: [0, 24],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const position = controller().workspace.state().position;
      move(position.x + direction[0], position.y + direction[1]);
    },
    clamp() {
      const p = controller().workspace.state().position;
      move(p.x, p.y);
    },
  };
}
