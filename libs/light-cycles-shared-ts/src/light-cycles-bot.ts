import type { SimulationContext } from '@pkgs/turn-game-shared-ts/simulation';
import type { LightCyclesConfig } from './light-cycles-config';
import {
  type LightCyclesHeading,
  legalHeadings,
  stepCell,
} from './light-cycles-heading';
import type { LightCyclesInput } from './light-cycles-input';
import {
  contestableCells,
  openCellIndex,
  reachableSpace,
} from './light-cycles-space';
import {
  type LightCyclesRider,
  type LightCyclesState,
  plannedHeading,
} from './light-cycles-state';

export type LightCyclesDifficulty = 'easy' | 'medium' | 'hard';

type Level = {
  /** Most cells one candidate's flood fill visits. */
  readonly reach: number;
  /** How a cell another rider could also enter is weighed. */
  readonly risk: 'ignore' | 'penalise' | 'avoid';
  /** Chance of keeping straight without looking. */
  readonly inattention: number;
};

const LEVELS: Readonly<Record<LightCyclesDifficulty, Level>> = {
  easy: { reach: 4, risk: 'ignore', inattention: 0.2 },
  medium: { reach: 24, risk: 'penalise', inattention: 0 },
  hard: { reach: 96, risk: 'avoid', inattention: 0 },
};

/** A blocked cell scores -1; risk lowers an open cell's score but keeps it above that. */
function headingScore(
  state: LightCyclesState,
  rider: LightCyclesRider,
  heading: LightCyclesHeading,
  context: { readonly level: Level; readonly risky: ReadonlySet<number> }
): number {
  const target = stepCell(rider, heading);
  const index = openCellIndex(state, target);
  if (index === null) return -1;
  const space = reachableSpace(state, target, context.level.reach);
  if (!context.risky.has(index)) return space;
  if (context.level.risk === 'avoid') return 0;
  if (context.level.risk === 'penalise') return Math.floor(space / 2);
  return space;
}

/** Straight, then left, then right win ties; a reversal is never a candidate. */
function bestHeading(
  state: LightCyclesState,
  rider: LightCyclesRider,
  level: Level
): LightCyclesHeading {
  const risky =
    level.risk === 'ignore'
      ? new Set<number>()
      : contestableCells(state, rider);
  let best = rider.heading;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const heading of legalHeadings(rider.heading)) {
    const score = headingScore(state, rider, heading, { level, risky });
    if (score > bestScore) {
      best = heading;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Bot commands for the framework's `(state, seat, difficulty, context)`
 * contract. A bot looks only on the tick just before a movement step and
 * otherwise repeats its planned heading, which the step ignores as no turn.
 */
export function lightCyclesBotInput(config: LightCyclesConfig) {
  return (
    state: LightCyclesState,
    seat: string,
    difficulty: LightCyclesDifficulty,
    context: SimulationContext
  ): LightCyclesInput => {
    const rider = state.riders.find((item) => item.seat === seat);
    if (rider === undefined) throw new Error(`no Light Cycles rider ${seat}`);
    const keep = { round: state.round, heading: plannedHeading(rider) };
    const deciding =
      state.phase === 'running' &&
      (state.phaseTick + 1) % config.movementTicks === 0;
    if (!rider.alive || !deciding || rider.turns.length > 0) return keep;
    const level = LEVELS[difficulty];
    if (level.inattention > 0 && context.random() < level.inattention)
      return keep;
    return { round: state.round, heading: bestHeading(state, rider, level) };
  };
}
