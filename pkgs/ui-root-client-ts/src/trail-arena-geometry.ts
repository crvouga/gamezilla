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

type Point = { x: number; y: number };
export type ArenaCamera = Point & { zoom: number };
export const FIT: ArenaCamera = { x: 0, y: 0, zoom: 1 };
const CENTER = { x: 0.5, y: 0.5 };
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Camera origins and pointer locations are fractions of the fitted drawing. */
export function inspectionCamera(paint: (camera: ArenaCamera) => void) {
  let view = FIT;
  const contacts = new Map<number, Point>();
  function move(from: Point, to: Point, factor: number) {
    const zoom = Math.max(1, Math.min(4, view.zoom * factor));
    const limit = 1 - 1 / zoom;
    view = {
      zoom,
      x: clamp(view.x + from.x / view.zoom - to.x / zoom, limit),
      y: clamp(view.y + from.y / view.zoom - to.y / zoom, limit),
    };
    paint(view);
  }
  function center() {
    const [a, b] = contacts.values();
    if (!a) return;
    if (!b) return a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return {
    move,
    scale: (factor: number) => move(CENTER, CENTER, factor),
    pan: (x: number, y: number) => move({ x, y }, { x: 0, y: 0 }, 1),
    fit() {
      contacts.clear();
      view = FIT;
      paint(view);
    },
    clear: () => contacts.clear(),
    start(id: number, point: Point) {
      if (contacts.size < 2) contacts.set(id, point);
    },
    drag(id: number, point: Point, aspect: number) {
      if (!contacts.has(id)) return;
      const before = center();
      // Measure physical finger separation, including the arena's aspect ratio.
      const pixelSpan = () => {
        const [a, b] = contacts.values();
        return a && b ? Math.hypot((a.x - b.x) * aspect, a.y - b.y) : 0;
      };
      const span = pixelSpan();
      contacts.set(id, point);
      const after = center();
      if (before && after)
        move(before, after, span > 0 ? pixelSpan() / span : 1);
    },
    end: (id: number) => contacts.delete(id),
  };
}
