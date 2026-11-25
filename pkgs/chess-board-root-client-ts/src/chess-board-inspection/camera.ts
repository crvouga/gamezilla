/** Positions are fractions of the fitted board. Resizing preserves the view. */
export type Point = { readonly x: number; readonly y: number };
export type Camera = Point & { readonly scale: number };
export const FIT: Camera = { scale: 1, x: 0, y: 0 };
export const CENTER: Point = { x: 0.5, y: 0.5 };

/** Keep the board point under the old midpoint beneath the new midpoint. */
export function reframe(
  view: Camera,
  from: Point,
  to: Point,
  zoom: number
): Camera {
  const scale = Math.min(4, Math.max(1, view.scale * zoom));
  const ratio = scale / view.scale;
  const bound = (p: number) => Math.max(1 - scale, Math.min(0, p));
  return {
    scale,
    x: bound(to.x - (from.x - view.x) * ratio),
    y: bound(to.y - (from.y - view.y) * ratio),
  };
}

export function span(points: ReadonlyMap<number, Point>) {
  const [a, b] = points.values();
  if (!a) return null;
  if (!b) return { center: a, distance: 0 };
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(b.x - a.x, b.y - a.y),
  };
}
