import {
  type LightCyclesConfig,
  type LightCyclesSeat,
  lightCyclesSeatIndex,
  lightCyclesSeatLayout,
} from './light-cycles-config';
import type { LightCyclesHeading } from './light-cycles-heading';
import { lightCyclesSpawn } from './light-cycles-spawns';

export type LightCyclesRider = {
  readonly seat: LightCyclesSeat;
  /** 0..width-1 from the left. */
  readonly x: number;
  /** 0..height-1 from the top. */
  readonly y: number;
  readonly heading: LightCyclesHeading;
  readonly alive: boolean;
  /** Pending turns, oldest first, bounded by `maxQueuedTurns`. */
  readonly turns: readonly LightCyclesHeading[];
};

export type LightCyclesPhase =
  | 'countdown'
  | 'running'
  | 'round-over'
  | 'completed';
export type LightCyclesCrashCause = 'wall' | 'trail' | 'contested' | 'retired';
export type LightCyclesCrash = {
  readonly seat: LightCyclesSeat;
  /** The cell the rider occupied when it was eliminated. */
  readonly x: number;
  readonly y: number;
  readonly cause: LightCyclesCrashCause;
};
export type LightCyclesResultReason = 'target score' | 'round limit';
export type LightCyclesResult = {
  readonly winner: LightCyclesSeat | 'draw';
  readonly reason: LightCyclesResultReason;
};

export type LightCyclesState = {
  readonly seats: readonly LightCyclesSeat[];
  readonly width: number;
  readonly height: number;
  readonly phase: LightCyclesPhase;
  readonly phaseTick: number;
  /** 1-based. */
  readonly round: number;
  /**
   * Row-major, width * height characters: '.' for an empty cell, otherwise
   * the owning seat's index '0'..'3'.
   */
  readonly trails: string;
  /** One per seat, in seat order. */
  readonly riders: readonly LightCyclesRider[];
  /** One per seat, in seat order. */
  readonly scores: readonly number[];
  readonly targetScore: number;
  readonly maxRounds: number;
  /** The last finished round's winner. */
  readonly roundWinner: LightCyclesSeat | 'draw' | null;
  readonly result: LightCyclesResult | null;
  /** This round's eliminations, in the order they happened. */
  readonly crashes: readonly LightCyclesCrash[];
};

export const EMPTY_CELL = '.';

export function trailMark(seat: LightCyclesSeat): string {
  return String(lightCyclesSeatIndex(seat));
}

export function cellIndex(
  state: Pick<LightCyclesState, 'width'>,
  x: number,
  y: number
): number {
  return y * state.width + x;
}

/** The riders and trails of a fresh round: everyone alive on its rotated spawn. */
export function lightCyclesRoundStart(
  seats: readonly LightCyclesSeat[],
  config: Pick<LightCyclesConfig, 'width' | 'height'>,
  round: number
): Pick<LightCyclesState, 'riders' | 'trails'> {
  const count = seats.length as 2 | 3 | 4;
  const cells = Array.from(
    { length: config.width * config.height },
    () => EMPTY_CELL
  );
  const riders = seats.map((seat, index): LightCyclesRider => {
    const spawn = lightCyclesSpawn(count, index, round);
    cells[spawn.y * config.width + spawn.x] = trailMark(seat);
    return {
      seat,
      x: spawn.x,
      y: spawn.y,
      heading: spawn.heading,
      alive: true,
      turns: [],
    };
  });
  return { riders, trails: cells.join('') };
}

export function initialLightCyclesState(
  config: LightCyclesConfig,
  seats: readonly LightCyclesSeat[]
): LightCyclesState {
  const layout = lightCyclesSeatLayout(seats);
  if (layout === null)
    throw new Error('Light Cycles seats must be 2, 3 or 4 riders in order');
  return {
    seats: layout,
    width: config.width,
    height: config.height,
    phase: 'countdown',
    phaseTick: 0,
    round: 1,
    ...lightCyclesRoundStart(layout, config, 1),
    scores: layout.map(() => 0),
    targetScore: config.targetScore,
    maxRounds: config.maxRounds,
    roundWinner: null,
    result: null,
    crashes: [],
  };
}

/** The heading a rider will have once its queued turns apply. */
export function plannedHeading(rider: LightCyclesRider): LightCyclesHeading {
  return rider.turns.at(-1) ?? rider.heading;
}

export function lightCyclesRider(
  state: LightCyclesState,
  seat: string
): LightCyclesRider | null {
  return state.riders.find((rider) => rider.seat === seat) ?? null;
}
