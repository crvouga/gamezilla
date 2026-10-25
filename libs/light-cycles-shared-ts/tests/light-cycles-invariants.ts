import type { LightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  isLightCyclesHeading,
  isReversal,
  stepCell,
} from '@libs/light-cycles-shared-ts/light-cycles-heading';
import {
  type LightCyclesRider,
  type LightCyclesState,
  trailMark,
} from '@libs/light-cycles-shared-ts/light-cycles-state';

/** Alive riders sit on distinct in-bounds cells of their own trail. */
export function shapeViolations(
  state: LightCyclesState,
  config: LightCyclesConfig
): string[] {
  const found: string[] = [];
  const occupied = new Set<number>();
  for (const rider of state.riders) {
    const inside =
      Number.isSafeInteger(rider.x) &&
      Number.isSafeInteger(rider.y) &&
      rider.x >= 0 &&
      rider.y >= 0 &&
      rider.x < config.width &&
      rider.y < config.height;
    if (!inside) found.push(`${rider.seat} left the arena`);
    if (!isLightCyclesHeading(rider.heading))
      found.push(`${rider.seat} heading`);
    if (rider.turns.length > config.maxQueuedTurns)
      found.push(`${rider.seat} queue overflow`);
    const index = rider.y * config.width + rider.x;
    if (state.trails[index] !== trailMark(rider.seat))
      found.push(`${rider.seat} cell is not its own trail`);
    if (rider.alive && occupied.has(index)) found.push('shared cell');
    if (rider.alive) occupied.add(index);
  }
  return found;
}

function markCount(trails: string, mark: string): number {
  let count = 0;
  for (const cell of trails) if (cell === mark) count++;
  return count;
}

function riderViolations(
  rider: LightCyclesRider,
  next: LightCyclesRider,
  trails: { readonly before: string; readonly after: string }
): string[] {
  const found: string[] = [];
  if (isReversal(rider.heading, next.heading))
    found.push(`${rider.seat} reversed`);
  const moved = rider.x !== next.x || rider.y !== next.y;
  if (rider.alive) {
    const ahead = stepCell(rider, next.heading);
    if (moved && (ahead.x !== next.x || ahead.y !== next.y))
      found.push(`${rider.seat} jumped`);
    return found;
  }
  if (moved || next.alive) found.push(`${rider.seat} moved while crashed`);
  const mark = trailMark(rider.seat);
  if (markCount(trails.after, mark) !== markCount(trails.before, mark))
    found.push(`${rider.seat} extended a trail while crashed`);
  return found;
}

/** Within a round, trails only grow and only alive riders move, one cell at most. */
export function roundViolations(
  before: LightCyclesState,
  after: LightCyclesState
): string[] {
  const found: string[] = [];
  for (let index = 0; index < before.trails.length; index++)
    if (
      before.trails[index] !== '.' &&
      after.trails[index] !== before.trails[index]
    )
      found.push(`trail cell ${index} changed`);
  const trails = { before: before.trails, after: after.trails };
  return [
    ...found,
    ...before.riders.flatMap((rider, index) =>
      riderViolations(rider, after.riders[index]!, trails)
    ),
  ];
}

/** Scores never fall and rise by one at most, only as a round ends with a survivor. */
export function scoringViolations(
  before: LightCyclesState,
  after: LightCyclesState
): string[] {
  if (before.phase === 'completed')
    return after === before ? [] : ['a completed match changed'];
  const gained = after.scores.map(
    (score, index) => score - before.scores[index]!
  );
  const total = gained.reduce((sum, gain) => sum + gain, 0);
  const ended =
    before.phase === 'running' &&
    (after.phase === 'round-over' || after.phase === 'completed');
  const expected = ended && after.roundWinner !== 'draw' ? 1 : 0;
  const found: string[] = [];
  if (gained.some((gain) => gain !== 0 && gain !== 1) || total !== expected)
    found.push(`scores moved by ${gained.join(',')}`);
  if (total === 1 && after.seats[gained.indexOf(1)] !== after.roundWinner)
    found.push('a rider other than the round winner scored');
  if (after.result?.winner === 'draw' && after.result.reason !== 'round limit')
    found.push('a drawn match without reaching the round limit');
  return found;
}
