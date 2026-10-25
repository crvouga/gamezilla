import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  type LightCyclesHeading,
  leftOf,
  oppositeHeading,
  rightOf,
  stepCell,
} from '@libs/light-cycles-shared-ts/light-cycles-heading';
import {
  EMPTY_CELL,
  type LightCyclesState,
  lightCyclesRider,
  plannedHeading,
} from '@libs/light-cycles-shared-ts/light-cycles-state';

/** A legal turn toward open road, a reversal, or a burst of four presses. */
export type SteerStyle = 'valid' | 'reversed' | 'burst';

function openCells(
  state: LightCyclesState,
  from: { readonly x: number; readonly y: number },
  heading: LightCyclesHeading
): number {
  let cell = stepCell(from, heading);
  let count = 0;
  while (
    count < state.width &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < state.width &&
    cell.y < state.height &&
    state.trails[cell.y * state.width + cell.x] === EMPTY_CELL
  ) {
    count++;
    cell = stepCell(cell, heading);
  }
  return count;
}

/** What a person would press: the side turn with more open road ahead. */
export function steeringFor(
  state: LightCyclesState,
  seat: LightCyclesSeat,
  style: SteerStyle
): readonly LightCyclesHeading[] {
  const rider = lightCyclesRider(state, seat);
  if (rider === null || !rider.alive) return [];
  const planned = plannedHeading(rider);
  if (style === 'reversed') return [oppositeHeading(planned)];
  const left = leftOf(planned);
  const right = rightOf(planned);
  const turn =
    openCells(state, rider, left) >= openCells(state, rider, right)
      ? left
      : right;
  return style === 'valid' ? [turn] : [turn, planned, turn, planned];
}
