import {
  type LightCyclesSeat,
  lightCyclesSeatIndex,
} from './light-cycles-config';
import {
  EMPTY_CELL,
  type LightCyclesCrashCause,
  trailMark,
} from './light-cycles-state';

/** One rider's intended next cell; it may lie outside the arena. */
export type LightCyclesProposal = {
  readonly seat: LightCyclesSeat;
  readonly x: number;
  readonly y: number;
};

export type LightCyclesMoveCrash = Exclude<LightCyclesCrashCause, 'retired'>;

export type LightCyclesMoveOutcome = LightCyclesProposal & {
  /** null when the rider entered its target cell. */
  readonly crash: LightCyclesMoveCrash | null;
};

export type LightCyclesMovement = {
  /** The pre-step trails plus every survivor's target. */
  readonly trails: string;
  /** One per proposal, sorted by canonical seat order. */
  readonly outcomes: readonly LightCyclesMoveOutcome[];
};

export type LightCyclesArena = {
  readonly trails: string;
  readonly width: number;
  readonly height: number;
};

function bySeat(a: LightCyclesProposal, b: LightCyclesProposal): number {
  return lightCyclesSeatIndex(a.seat) - lightCyclesSeatIndex(b.seat);
}

function crashOf(
  arena: LightCyclesArena,
  proposal: LightCyclesProposal,
  claims: ReadonlyMap<number, number>
): LightCyclesMoveCrash | null {
  const { x, y } = proposal;
  if (x < 0 || y < 0 || x >= arena.width || y >= arena.height) return 'wall';
  const index = y * arena.width + x;
  if (arena.trails[index] !== EMPTY_CELL) return 'trail';
  return (claims.get(index) ?? 0) >= 2 ? 'contested' : null;
}

/**
 * Resolves every proposal simultaneously against the pre-step trails: a
 * target outside the arena is a wall crash, an occupied target a trail crash
 * (which also covers head swaps and old heads), and an empty target claimed
 * by two or more riders crashes all of them. The result does not depend on
 * the order of `proposals`.
 */
export function resolveMovement(
  arena: LightCyclesArena,
  proposals: readonly LightCyclesProposal[]
): LightCyclesMovement {
  if (arena.trails.length !== arena.width * arena.height)
    throw new Error('Light Cycles trails do not match the arena');
  const sorted = [...proposals].sort(bySeat);
  if (new Set(sorted.map((proposal) => proposal.seat)).size !== sorted.length)
    throw new Error('one Light Cycles rider proposed twice');
  const claims = new Map<number, number>();
  for (const { x, y } of sorted)
    if (x >= 0 && y >= 0 && x < arena.width && y < arena.height) {
      const index = y * arena.width + x;
      claims.set(index, (claims.get(index) ?? 0) + 1);
    }
  const outcomes = sorted.map(
    (proposal): LightCyclesMoveOutcome => ({
      ...proposal,
      crash: crashOf(arena, proposal, claims),
    })
  );
  const cells = arena.trails.split('');
  for (const outcome of outcomes)
    if (outcome.crash === null)
      cells[outcome.y * arena.width + outcome.x] = trailMark(outcome.seat);
  return { trails: cells.join(''), outcomes };
}
