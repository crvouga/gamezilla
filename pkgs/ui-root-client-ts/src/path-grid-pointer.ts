import type { PathGridBoardProps } from './path-grid-types';

type Point = { readonly x: number; readonly y: number };
type Grid = { readonly columns: number; readonly rows: number };

/** Cells under a straight pointer segment, including crossed cells between samples. */
export function pathGridSegment(from: Point, to: Point, grid: Grid): number[] {
  let x = Math.floor(from.x);
  let y = Math.floor(from.y);
  const endX = Math.floor(to.x);
  const endY = Math.floor(to.y);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const stepX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const stepY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let crossX =
    dx === 0 ? Infinity : (sx > 0 ? x + 1 - from.x : from.x - x) / Math.abs(dx);
  let crossY =
    dy === 0 ? Infinity : (sy > 0 ? y + 1 - from.y : from.y - y) / Math.abs(dy);
  const cells: number[] = [];
  // A straight segment crosses at most one row and one column boundary per step.
  for (
    let n = 0;
    n < grid.columns + grid.rows && (x !== endX || y !== endY);
    n++
  ) {
    if (crossX <= crossY) {
      x += sx;
      crossX += stepX;
    } else {
      y += sy;
      crossY += stepY;
    }
    if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) break;
    cells.push(y * grid.columns + x);
  }
  return cells;
}

export function createPathGridPointer(
  props: PathGridBoardProps,
  element: () => HTMLDivElement | undefined
) {
  let active: number | null = null;
  let previous: Point | null = null;
  const point = (event: PointerEvent): Point | null => {
    const box = element()?.getBoundingClientRect();
    if (box === undefined || box.width <= 0 || box.height <= 0) return null;
    const x = ((event.clientX - box.left) / box.width) * props.columns;
    const y = ((event.clientY - box.top) / box.height) * props.rows;
    return x >= 0 && y >= 0 && x < props.columns && y < props.rows
      ? { x, y }
      : null;
  };
  const cancel = (): void => {
    if (active === null) return;
    const pointer = active;
    active = null;
    previous = null;
    element()?.releasePointerCapture(pointer);
    props.onTraceCancel?.();
  };
  const move = (event: PointerEvent): void => {
    if (active !== event.pointerId || props.disabled === true) return;
    event.preventDefault();
    const next = point(event);
    if (next === null || previous === null) return;
    for (const cell of pathGridSegment(previous, next, props))
      props.onTraceMove?.(cell);
    previous = next;
  };
  return {
    cancel,
    down(event: PointerEvent): void {
      if (
        active !== null ||
        props.disabled === true ||
        props.onTraceStart === undefined ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      const start = point(event);
      if (start === null) return;
      event.preventDefault();
      active = event.pointerId;
      previous = start;
      element()?.setPointerCapture(event.pointerId);
      props.onTraceStart(
        Math.floor(start.y) * props.columns + Math.floor(start.x)
      );
    },
    move,
    up(event: PointerEvent): void {
      if (active !== event.pointerId) return;
      move(event);
      const pointer = active;
      active = null;
      previous = null;
      element()?.releasePointerCapture(pointer);
      if (props.disabled !== true) props.onTraceEnd?.();
    },
    lost(event: PointerEvent): void {
      if (active === event.pointerId) cancel();
    },
  };
}
