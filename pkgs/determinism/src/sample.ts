import type { SeededRng } from '@pkgs/uuid';
import type { EntropyTrace } from './trace';

/**
 * Pick one element under seed control.
 * Forced choice (length === 1) consumes **no** entropy — critical for
 * trace stability when pool sizes fluctuate across replay.
 * Empty arrays throw.
 */
export function sample<T>(
  rng: SeededRng,
  reason: string,
  items: readonly T[],
  trace?: EntropyTrace
): T {
  if (items.length === 0) {
    throw new Error(`sample(${reason}): empty`);
  }
  if (items.length === 1) {
    trace?.recordSample({ reason, index: 0, size: 1, consumed: false });
    return items[0]!;
  }
  const index = rng.int(items.length);
  trace?.recordSample({ reason, index, size: items.length, consumed: true });
  return items[index]!;
}
