import { stepCell } from '@libs/light-cycles-shared-ts/light-cycles-heading';
import {
  EMPTY_CELL,
  type LightCyclesRider,
  type LightCyclesState,
  trailMark,
} from '@libs/light-cycles-shared-ts/light-cycles-state';

/** One published arena, decoded, with what the authority acknowledged. */
export type ArenaSample = {
  readonly revision: number;
  readonly tick: number;
  readonly state: LightCyclesState;
  readonly encoded: string;
  readonly acknowledged: Readonly<Record<string, number>>;
};

const MOVEMENT_TICKS = 3;
const playing = (state: LightCyclesState) =>
  state.phase === 'countdown' || state.phase === 'running';

/** Alive riders are inside the arena, on distinct cells, each on its own trail. */
export function arenaViolations(sample: ArenaSample): string[] {
  const { state } = sample;
  const problems: string[] = [];
  const cells = new Set<string>();
  for (const rider of state.riders) {
    if (!rider.alive) continue;
    const at = `${rider.x},${rider.y}`;
    if (
      rider.x < 0 ||
      rider.y < 0 ||
      rider.x >= state.width ||
      rider.y >= state.height
    )
      problems.push(`${rider.seat} is outside the arena at ${at}`);
    else if (
      state.trails[rider.y * state.width + rider.x] !== trailMark(rider.seat)
    )
      problems.push(`${rider.seat} is not on its own trail at ${at}`);
    if (cells.has(at)) problems.push(`two alive riders share ${at}`);
    cells.add(at);
  }
  const finished = state.round - (playing(state) ? 1 : 0);
  const scored = state.scores.reduce((sum, score) => sum + score, 0);
  if (scored > finished)
    problems.push(`${scored} round wins after ${finished} finished rounds`);
  return problems.map((problem) => `revision ${sample.revision}: ${problem}`);
}

type Steps = { readonly count: number; readonly exact: boolean };

/** Movement steps from `a` to `b` inside one round: exact while riding, else a bound. */
function movementSteps(a: ArenaSample, b: ArenaSample): Steps {
  if (a.state.phase === 'running' && b.state.phase === 'running')
    return {
      count:
        Math.floor(b.state.phaseTick / MOVEMENT_TICKS) -
        Math.floor(a.state.phaseTick / MOVEMENT_TICKS),
      exact: true,
    };
  if (!playing(a.state)) return { count: 0, exact: false };
  return { count: Math.ceil((b.tick - a.tick) / MOVEMENT_TICKS), exact: false };
}

function newCells(a: LightCyclesState, b: LightCyclesState, mark: string) {
  let count = 0;
  for (let index = 0; index < b.trails.length; index++)
    if (b.trails[index] === mark && a.trails[index] !== mark) count++;
  return count;
}

function trailViolations(a: LightCyclesState, b: LightCyclesState): string[] {
  for (let index = 0; index < a.trails.length; index++)
    if (a.trails[index] !== EMPTY_CELL && b.trails[index] !== a.trails[index])
      return [`the trail cell ${index} changed within round ${a.round}`];
  return [];
}

function riderMoveViolations(
  before: LightCyclesRider,
  after: LightCyclesRider,
  { count: steps, exact }: Steps
): string[] {
  const problems: string[] = [];
  if (after.alive && !before.alive)
    problems.push(`${after.seat} came back to life within a round`);
  if (!before.alive || !after.alive) return problems;
  const distance = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
  if (distance > steps)
    problems.push(`${after.seat} moved ${distance} cells in ${steps} steps`);
  if (!exact) return problems;
  if (steps === 0 && after.heading !== before.heading)
    problems.push(`${after.seat} turned without a movement step`);
  if (steps === 1) {
    const ahead = stepCell(before, after.heading);
    if (ahead.x !== after.x || ahead.y !== after.y)
      problems.push(`${after.seat} left its heading's next cell`);
  }
  return problems;
}

/**
 * A rider's turns only grow by commands its own seat had acknowledged; with
 * nothing new acknowledged its queue only drains, front first.
 */
function commandViolations(
  a: ArenaSample,
  b: ArenaSample,
  before: LightCyclesRider,
  after: LightCyclesRider
): string[] {
  if (!before.alive || !after.alive || !playing(a.state) || !playing(b.state))
    return [];
  const applied =
    (b.acknowledged[after.seat] ?? 0) - (a.acknowledged[after.seat] ?? 0);
  if (applied < 0) return [`${after.seat}'s acknowledgment went back`];
  if (applied > 0)
    return after.turns.length > before.turns.length + applied
      ? [`${after.seat} queued more turns than it sent`]
      : [];
  const drained = before.turns.slice(before.turns.length - after.turns.length);
  const known = [before.heading, ...before.turns];
  return drained.join() === after.turns.join() && known.includes(after.heading)
    ? []
    : [`${after.seat} changed course with no command of its own`];
}

function scoreViolations(a: LightCyclesState, b: LightCyclesState): string[] {
  const problems: string[] = [];
  b.scores.forEach((score, index) => {
    if (score < (a.scores[index] ?? 0))
      problems.push(`${b.seats[index]}'s round wins went down`);
  });
  const sum = (state: LightCyclesState) =>
    state.scores.reduce((total, score) => total + score, 0);
  const finished = (state: LightCyclesState) =>
    state.round - (playing(state) ? 1 : 0);
  if (sum(b) - sum(a) > finished(b) - finished(a))
    problems.push('a round was scored more than once');
  return problems;
}

/** What may change between two consecutive publications of one game. */
export function transitionViolations(a: ArenaSample, b: ArenaSample): string[] {
  const problems: string[] = [];
  if (b.tick < a.tick) problems.push('the published tick went back');
  if (b.state.round < a.state.round) problems.push('the round went back');
  if (a.state.phase === 'completed' && b.encoded !== a.encoded)
    problems.push('a completed game changed');
  problems.push(...scoreViolations(a.state, b.state));
  if (b.state.round === a.state.round) {
    problems.push(...trailViolations(a.state, b.state));
    const steps = movementSteps(a, b);
    b.state.riders.forEach((after, index) => {
      const before = a.state.riders[index]!;
      problems.push(...riderMoveViolations(before, after, steps));
      problems.push(...commandViolations(a, b, before, after));
      const added = newCells(a.state, b.state, trailMark(after.seat));
      if (added > Math.max(0, steps.count))
        problems.push(
          `${after.seat} laid ${added} cells in ${steps.count} steps`
        );
    });
  }
  return problems.map(
    (problem) => `revisions ${a.revision}→${b.revision}: ${problem}`
  );
}
