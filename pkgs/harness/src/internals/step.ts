import type { SeededRng } from '@pkgs/uuid';
import type { TraceRecorder } from './trace';

/**
 * Resolve one Step: pick among `alternatives` at the choice site `choiceId`.
 * A forced choice (one alternative) consumes no entropy so the choice stream
 * does not depend on transient pool sizes.
 */
export function choose<T>(
  rng: SeededRng,
  choiceId: string,
  alternatives: readonly T[],
  trace?: TraceRecorder
): T {
  if (alternatives.length === 0) {
    throw new Error(`choose(${choiceId}): no alternatives`);
  }
  if (alternatives.length === 1) {
    trace?.record({
      type: 'choice',
      id: choiceId,
      index: 0,
      size: 1,
      consumed: false,
    });
    return alternatives[0]!;
  }
  const index = rng.int(alternatives.length);
  trace?.record({
    type: 'choice',
    id: choiceId,
    index,
    size: alternatives.length,
    consumed: true,
  });
  return alternatives[index]!;
}
