import type { SeededRng } from '@pkgs/uuid';
import type { SimTrace } from './trace';

export function sample<T>(
  rng: SeededRng,
  reason: string,
  items: readonly T[],
  trace?: SimTrace
): T {
  if (items.length === 0) {
    throw new Error(`sample(${reason}): empty`);
  }
  if (items.length === 1) {
    trace?.record({
      type: 'sample',
      reason,
      index: 0,
      size: 1,
      consumed: false,
    });
    return items[0]!;
  }
  const index = rng.int(items.length);
  trace?.record({
    type: 'sample',
    reason,
    index,
    size: items.length,
    consumed: true,
  });
  return items[index]!;
}
