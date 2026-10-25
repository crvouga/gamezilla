import type { LightCyclesRiderCount } from './light-cycles-config';
import type {
  LightCyclesCell,
  LightCyclesHeading,
} from './light-cycles-heading';

export type LightCyclesSpawn = LightCyclesCell & {
  readonly heading: LightCyclesHeading;
};

/**
 * The four starting cells, in seat order, inset a quarter of the arena from
 * its edges and symmetric under a half turn: on the 40 x 28 arena (zero-based
 * x from the left, y from the top) 9/6 right, 30/21 left, 30/6 down and
 * 9/21 up — columns and rows 10/7, 31/22, 31/7 and 10/22 counted from one.
 * A mode uses the first n.
 */
export function lightCyclesStarts(arena: {
  readonly width: number;
  readonly height: number;
}): readonly LightCyclesSpawn[] {
  const x = Math.max(0, Math.floor(arena.width / 4) - 1);
  const y = Math.max(0, Math.floor(arena.height / 4) - 1);
  const right = arena.width - 1 - x;
  const bottom = arena.height - 1 - y;
  return [
    { x, y, heading: 'right' },
    { x: right, y: bottom, heading: 'left' },
    { x: right, y, heading: 'down' },
    { x, y: bottom, heading: 'up' },
  ];
}

/** Round `round` (1-based) gives seat `seatIndex` the start (i + r - 1) mod n. */
export function lightCyclesSpawn(
  arena: { readonly width: number; readonly height: number },
  count: LightCyclesRiderCount,
  seatIndex: number,
  round: number
): LightCyclesSpawn {
  const spawn = lightCyclesStarts(arena)[(seatIndex + round - 1) % count];
  if (spawn === undefined) throw new Error('unknown Light Cycles spawn');
  return spawn;
}
