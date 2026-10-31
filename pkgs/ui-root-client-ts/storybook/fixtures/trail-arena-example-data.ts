import type {
  TrailCrash,
  TrailHeading,
  TrailRider,
  TrailRiderIndex,
  TrailSlot,
} from '@pkgs/ui-root-client-ts/trail-arena-types';

export const ARENA_WIDTH = 40;
export const ARENA_HEIGHT = 28;

type Point = readonly [number, number];

/** Cells of a straight walk through `points`, corner to corner. */
function walk(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] ?? [0, 0];
    const [bx, by] = points[i] ?? [0, 0];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = i === 1 ? 0 : 1; s <= steps; s++)
      out.push([ax + Math.sign(bx - ax) * s, ay + Math.sign(by - ay) * s]);
  }
  return out;
}

function corners(trail: string): Point[] {
  return trail
    .split(' ')
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return [x ?? 0, y ?? 0];
    });
}

/**
 * A cells string from each rider's trail, in rider order, written as the
 * corners it turned at: `'4,4 20,4 20,12'`.
 */
export function paintCells(trails: readonly string[]): string {
  const cells: string[] = Array.from(
    { length: ARENA_WIDTH * ARENA_HEIGHT },
    () => '.'
  );
  trails.forEach((trail, index) => {
    for (const [x, y] of walk(corners(trail)))
      cells[y * ARENA_WIDTH + x] = `${index}`;
  });
  return cells.join('');
}

const NAMES = ['Comet', 'Ember', 'Nova', 'Volt'] as const;

export function rider(
  index: TrailRiderIndex,
  at: Point,
  heading: TrailHeading,
  options: { alive?: boolean; controlled?: boolean } = {}
): TrailRider {
  return {
    index,
    x: at[0],
    y: at[1],
    heading,
    alive: options.alive ?? true,
    mark: NAMES[index].charAt(0),
    controlled: options.controlled ?? false,
    label: NAMES[index],
  };
}

const STEP: Readonly<Record<TrailHeading, Point>> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

const REVERSE: Readonly<Record<TrailHeading, TrailHeading>> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

export type ExampleRound = {
  readonly cells: string;
  readonly riders: readonly TrailRider[];
  readonly crashes: readonly TrailCrash[];
};

/**
 * One press, one cell: the steered rider turns (never straight back) and
 * rides a cell, leaving trail; a wall or a trail ends its ride.
 */
export function stepRound(
  round: ExampleRound,
  heading: TrailHeading,
  slot: TrailSlot
): ExampleRound {
  const steered = round.riders.filter((r) => r.controlled)[slot];
  if (steered === undefined || !steered.alive) return round;
  const turn = heading === REVERSE[steered.heading] ? steered.heading : heading;
  const x = steered.x + STEP[turn][0];
  const y = steered.y + STEP[turn][1];
  const inside = x >= 0 && y >= 0 && x < ARENA_WIDTH && y < ARENA_HEIGHT;
  const free = inside && round.cells[y * ARENA_WIDTH + x] === '.';
  const cells = round.cells.split('');
  cells[steered.y * ARENA_WIDTH + steered.x] = `${steered.index}`;
  const moved: TrailRider = free
    ? { ...steered, x, y, heading: turn }
    : { ...steered, heading: turn, alive: false };
  return {
    cells: cells.join(''),
    riders: round.riders.map((r) => (r === steered ? moved : r)),
    crashes: free
      ? round.crashes
      : [
          ...round.crashes,
          { index: steered.index, x: steered.x, y: steered.y },
        ],
  };
}
