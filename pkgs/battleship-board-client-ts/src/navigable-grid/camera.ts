export type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
export const FIT: Camera = { x: 0, y: 0, scale: 1 };

export function moveCamera(
  view: Camera,
  box: DOMRect,
  motion: { from: Point; to: Point; factor: number }
): Camera {
  const scale = Math.max(1, Math.min(3, view.scale * motion.factor));
  const axis = (key: 'x' | 'y', origin: number, size: number) =>
    Math.max(
      size * (1 - scale),
      Math.min(
        0,
        motion.to[key] -
          origin -
          ((motion.from[key] - origin - view[key]) * scale) / view.scale
      )
    );
  return {
    scale,
    x: axis('x', box.left, box.width),
    y: axis('y', box.top, box.height),
  };
}

export function contactFrame(points: Map<number, Point>) {
  const [a, b = a] = points.values();
  if (!a || !b) return null;
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    span: Math.hypot(a.x - b.x, a.y - b.y),
  };
}
