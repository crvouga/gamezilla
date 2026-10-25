import {
  LIGHT_CYCLES_HEADINGS,
  type LightCyclesCell,
  legalHeadings,
  stepCell,
} from './light-cycles-heading';
import {
  EMPTY_CELL,
  type LightCyclesRider,
  type LightCyclesState,
} from './light-cycles-state';

type Arena = Pick<LightCyclesState, 'trails' | 'width' | 'height'>;

/** The cell's index when it lies inside the arena and is empty, else null. */
export function openCellIndex(arena: Arena, cell: LightCyclesCell) {
  if (cell.x < 0 || cell.y < 0) return null;
  if (cell.x >= arena.width || cell.y >= arena.height) return null;
  const index = cell.y * arena.width + cell.x;
  return arena.trails[index] === EMPTY_CELL ? index : null;
}

/**
 * Empty cells reachable from `start` (counted when open), visiting at most
 * `limit` cells: work is bounded by the limit, never by the arena size.
 */
export function reachableSpace(
  arena: Arena,
  start: LightCyclesCell,
  limit: number
): number {
  const first = openCellIndex(arena, start);
  if (first === null) return 0;
  const seen = new Set<number>([first]);
  const frontier: LightCyclesCell[] = [start];
  for (let next = 0; next < frontier.length && seen.size < limit; next++) {
    const cell = frontier[next]!;
    for (const heading of LIGHT_CYCLES_HEADINGS) {
      const neighbour = stepCell(cell, heading);
      const index = openCellIndex(arena, neighbour);
      if (index === null || seen.has(index) || seen.size >= limit) continue;
      seen.add(index);
      frontier.push(neighbour);
    }
  }
  return seen.size;
}

/** Empty cells some other alive rider could enter at the next movement step. */
export function contestableCells(
  state: LightCyclesState,
  rider: LightCyclesRider
): ReadonlySet<number> {
  const cells = new Set<number>();
  for (const other of state.riders) {
    if (!other.alive || other.seat === rider.seat) continue;
    for (const heading of legalHeadings(other.heading)) {
      const index = openCellIndex(state, stepCell(other, heading));
      if (index !== null) cells.add(index);
    }
  }
  return cells;
}
