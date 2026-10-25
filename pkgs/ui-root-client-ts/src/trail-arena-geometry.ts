import type { TrailHeading } from './trail-arena-types';

/** One rider's trail: a single path of merged row runs, and its cell count. */
export type TrailShape = { readonly d: string; readonly count: number };

const OWNERS = 4;

function owner(code: number): number {
  const index = code - 48;
  return index >= 0 && index < OWNERS ? index : -1;
}

/**
 * Every rider's trail in one pass over the grid. Horizontal runs of one
 * owner merge into one rectangle, so a path's size follows the trail's
 * turns, not its length; a trail is one `<path>` however long it grows.
 */
export function trailShapes(
  cells: string,
  width: number,
  height: number
): readonly TrailShape[] {
  const parts: string[][] = [[], [], [], []];
  const counts = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    let start = 0;
    let current = -1;
    for (let x = 0; x <= width; x++) {
      const next = x < width ? owner(cells.charCodeAt(y * width + x)) : -1;
      if (next >= 0) counts[next] = (counts[next] ?? 0) + 1;
      if (next === current) continue;
      if (current >= 0)
        parts[current]?.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
      start = x;
      current = next;
    }
  }
  return parts.map((part, index) => ({
    d: part.join(''),
    count: counts[index] ?? 0,
  }));
}

const ROTATION: Readonly<Record<TrailHeading, number>> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

/** Degrees clockwise from facing up. */
export function headingRotation(heading: TrailHeading): number {
  return ROTATION[heading];
}
