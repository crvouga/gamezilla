import type { LightCyclesRiderCount } from './light-cycles-config';
import type {
  LightCyclesCell,
  LightCyclesHeading,
} from './light-cycles-heading';

export type LightCyclesSpawn = LightCyclesCell & {
  readonly heading: LightCyclesHeading;
};

/**
 * The four starting cells on the 40 x 28 arena, in seat order (zero-based
 * x from the left, y from the top; columns and rows 10/7, 31/22, 31/7 and
 * 10/22 counted from one). A mode uses the first n. Each faces at least
 * 5 empty cells before a wall, and the layout is symmetric under a half turn.
 */
const STARTS: readonly LightCyclesSpawn[] = Object.freeze([
  { x: 9, y: 6, heading: 'right' },
  { x: 30, y: 21, heading: 'left' },
  { x: 30, y: 6, heading: 'down' },
  { x: 9, y: 21, heading: 'up' },
]);

export const LIGHT_CYCLES_SPAWNS: Readonly<
  Record<LightCyclesRiderCount, readonly LightCyclesSpawn[]>
> = Object.freeze({
  2: Object.freeze(STARTS.slice(0, 2)),
  3: Object.freeze(STARTS.slice(0, 3)),
  4: STARTS,
});

/** Round `round` (1-based) gives seat `seatIndex` the spawn (i + r - 1) mod n. */
export function lightCyclesSpawn(
  count: LightCyclesRiderCount,
  seatIndex: number,
  round: number
): LightCyclesSpawn {
  const spawns = LIGHT_CYCLES_SPAWNS[count];
  const spawn = spawns[(seatIndex + round - 1) % count];
  if (spawn === undefined) throw new Error('unknown Light Cycles spawn');
  return spawn;
}
