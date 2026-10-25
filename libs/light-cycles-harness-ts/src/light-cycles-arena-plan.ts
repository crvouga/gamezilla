import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import type {
  LightCyclesCrash,
  LightCyclesRider,
  LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import {
  cellName,
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesBoardShown,
  type LightCyclesCell,
  type LightCyclesDirection,
  type LightCyclesRiderName,
} from './light-cycles-board-view';

/** Where a scenario puts one rider: riding on a cell, or crashed on it. */
export type LightCyclesPlacement = LightCyclesCell & {
  readonly heading: LightCyclesDirection;
  readonly riding: boolean;
};

/**
 * An arena as a scenario states it: some riders placed, some trail cells
 * named (by owner, or by anybody), everything else up to the harness.
 */
export type LightCyclesArenaPlan = {
  readonly placed: Partial<Record<LightCyclesRiderName, LightCyclesPlacement>>;
  readonly trails: Partial<Record<LightCyclesRiderName, LightCyclesCell[]>>;
  /** Cells some trail covers, whoever's. */
  readonly anyTrails: readonly LightCyclesCell[];
  /** Riders crashed somewhere out of the way, where the scenario does not say. */
  readonly crashedAside?: readonly LightCyclesRiderName[];
};

export const EMPTY_ARENA_PLAN: LightCyclesArenaPlan = {
  placed: {},
  trails: {},
  anyTrails: [],
};

const SEATS: readonly LightCyclesSeat[] = ['white', 'black', 'red', 'blue'];
const STEP: Readonly<
  Record<LightCyclesDirection, { readonly dx: number; readonly dy: number }>
> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

/**
 * Long straight lanes away from every cell the scenarios name, for riders a
 * scenario leaves unplaced: each rides 37 cells before it would reach an
 * edge, longer than any scenario lets time pass on a placed arena.
 */
const LANES: readonly LightCyclesPlacement[] = [
  { column: 38, row: 25, heading: 'left', riding: true },
  { column: 3, row: 3, heading: 'right', riding: true },
  { column: 38, row: 23, heading: 'left', riding: true },
];

function behind(
  cell: LightCyclesCell,
  heading: LightCyclesDirection
): LightCyclesCell {
  const step = STEP[heading];
  return { column: cell.column - step.dx, row: cell.row - step.dy };
}

/** Every rider's placement: the scenario's, else the next free lane. */
export function placements(
  plan: LightCyclesArenaPlan,
  count: number
): LightCyclesPlacement[] {
  const lanes = [...LANES];
  return LIGHT_CYCLES_RIDER_NAMES.slice(0, count).map((name) => {
    const placed = plan.placed[name];
    if (placed !== undefined) return placed;
    const lane = lanes.shift();
    if (lane === undefined)
      throw new Error('No lane left for an unplaced rider');
    return plan.crashedAside?.includes(name) === true
      ? { ...lane, riding: false }
      : lane;
  });
}

/**
 * The state that shows `plan`. With `oneStepBefore`, every riding rider
 * stands one cell behind its place instead, so the arena's next step lands
 * every rider where the plan puts it while the riders keep their pace.
 */
export function arenaState(
  saved: LightCyclesState,
  plan: LightCyclesArenaPlan,
  oneStepBefore: boolean
): LightCyclesState {
  const count = saved.seats.length;
  const cells = Array.from({ length: saved.width * saved.height }, () => '.');
  const mark = (cell: LightCyclesCell, index: number) => {
    const at = (cell.row - 1) * saved.width + (cell.column - 1);
    if (cells[at] !== '.' && cells[at] !== String(index))
      throw new Error(`Two trails share column ${cellName(cell)}`);
    cells[at] = String(index);
  };
  const crashes: LightCyclesCrash[] = [];
  const riders = placements(plan, count).map(
    (placed, index): LightCyclesRider => {
      const name = LIGHT_CYCLES_RIDER_NAMES[index]!;
      const seat = SEATS[index]!;
      for (const cell of plan.trails[name] ?? []) mark(cell, index);
      const start =
        oneStepBefore && placed.riding
          ? behind(placed, placed.heading)
          : placed;
      mark(start, index);
      if (!placed.riding)
        crashes.push({
          seat,
          x: placed.column - 1,
          y: placed.row - 1,
          cause: 'trail',
        });
      return {
        seat,
        x: start.column - 1,
        y: start.row - 1,
        heading: placed.heading,
        alive: placed.riding,
        turns: [],
      };
    }
  );
  // Cells "some trail" covers belong to the first rider the scenario left unplaced, else Comet.
  const owner = Math.max(
    0,
    LIGHT_CYCLES_RIDER_NAMES.slice(0, count).findIndex(
      (name) => plan.placed[name] === undefined
    )
  );
  for (const cell of plan.anyTrails) mark(cell, owner);
  return {
    ...saved,
    phase: 'running',
    phaseTick: 3,
    riders,
    trails: cells.join(''),
    crashes,
    result: null,
  };
}

/** Whether `board` shows every rider, trail and crash `plan` names. */
export function planHolds(
  plan: LightCyclesArenaPlan,
  board: LightCyclesBoardShown
): boolean {
  const riderOf = (name: LightCyclesRiderName) =>
    board.riders.find((rider) => rider.name === name);
  for (const [name, placed] of Object.entries(plan.placed)) {
    const rider = riderOf(name as LightCyclesRiderName);
    if (
      rider === undefined ||
      rider.column !== placed.column ||
      rider.row !== placed.row ||
      rider.riding !== placed.riding ||
      (placed.riding && rider.heading !== placed.heading)
    )
      return false;
  }
  for (const [name, cells] of Object.entries(plan.trails)) {
    const trail = riderOf(name as LightCyclesRiderName)?.trail ?? [];
    if (!cells.every((cell) => trail.includes(cellName(cell)))) return false;
  }
  for (const name of plan.crashedAside ?? [])
    if (riderOf(name)?.riding !== false) return false;
  return plan.anyTrails.every((cell) =>
    board.riders.some((rider) => rider.trail.includes(cellName(cell)))
  );
}
