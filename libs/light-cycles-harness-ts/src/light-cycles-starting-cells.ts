import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  cellName,
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesCell,
  type LightCyclesDirection,
  type LightCyclesRiderName,
  lightCyclesBoardShown,
} from './light-cycles-board-view';
import { lightCyclesLineup, lightCyclesObserver } from './light-cycles-lineup';

type StartingCell = LightCyclesCell & {
  readonly heading: LightCyclesDirection;
};

/** The first round's starting cells, by seat, as the glossary states them. */
const FIRST_ROUND: readonly StartingCell[] = [
  { column: 10, row: 7, heading: 'right' },
  { column: 31, row: 22, heading: 'left' },
  { column: 31, row: 7, heading: 'down' },
  { column: 10, row: 22, heading: 'up' },
];

/**
 * Where `rider` waits in `round`: each new round every rider takes the next
 * rider's starting cell in seat order, the last rider taking Comet's.
 */
export function startingCellOf(
  count: number,
  rider: LightCyclesRiderName,
  round: number
): StartingCell {
  const seat = LIGHT_CYCLES_RIDER_NAMES.indexOf(rider);
  return FIRST_ROUND[(seat + round - 1) % count]!;
}

/**
 * Whether each of `riders` waits on its own starting cell for the round the
 * arena shows, its trail that cell alone: `riding` while the round
 * counts down, or set off from it in its starting direction since.
 */
export async function onStartingCells(
  s: ProductHarness,
  riders: readonly LightCyclesRiderName[],
  since: 'waiting' | 'set off'
): Promise<boolean> {
  const { count } = lightCyclesLineup(s);
  const board = await lightCyclesBoardShown(s, lightCyclesObserver(s));
  return riders.every((name) => {
    const rider = board.riders.find((shown) => shown.name === name);
    const start = startingCellOf(count, name, board.round);
    if (rider === undefined || rider.heading !== start.heading) return false;
    if (since === 'waiting')
      return (
        board.phase === 'countdown' &&
        rider.column === start.column &&
        rider.row === start.row &&
        rider.trail.length === 1 &&
        rider.trail[0] === cellName(start)
      );
    return (
      board.phase === 'running' &&
      rider.riding &&
      rider.trail.includes(cellName(start))
    );
  });
}
