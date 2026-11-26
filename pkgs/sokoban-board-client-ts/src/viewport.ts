export type Point = { x: number; y: number };
export type View = Point & { scale: number };
export const fit: View = { scale: 1, x: 0, y: 0 };

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Coordinates are fractions of the visible board. Preserve the world point
 * beneath the old midpoint at the new one, until an edge reaches the frame. */
export function navigate(
  view: View,
  from: Point,
  to: Point,
  factor: number
): View {
  const scale = clamp(view.scale * factor, 1, 4);
  const ratio = scale / view.scale;
  return {
    scale,
    x: clamp(to.x - (from.x - view.x) * ratio, 1 - scale, 0),
    y: clamp(to.y - (from.y - view.y) * ratio, 1 - scale, 0),
  };
}

export function tileUnder(
  view: View,
  point: Point,
  columns: number,
  rows: number
) {
  if (!(point.x >= 0 && point.y >= 0 && point.x < 1 && point.y < 1))
    return null;
  const column = Math.floor(((point.x - view.x) * columns) / view.scale);
  const row = Math.floor(((point.y - view.y) * rows) / view.scale);
  return row * columns + column;
}

export function boardCamera(board: HTMLElement) {
  let view = fit;
  let box: DOMRect;
  function measure() {
    box = board.getBoundingClientRect();
    return box;
  }
  function point(pixel: Point): Point {
    return {
      x: (pixel.x - box.left) / box.width,
      y: (pixel.y - box.top) / box.height,
    };
  }
  function move(from: Point, to: Point, factor: number) {
    view = navigate(view, from, to, factor);
    board.style.setProperty(
      '--warehouse-camera',
      `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`
    );
    board.dataset['magnified'] = String(view.scale > 1);
  }
  return { measure, point, move, read: () => view };
}
