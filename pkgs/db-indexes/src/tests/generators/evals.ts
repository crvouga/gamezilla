import { fc } from '@pkgs/pbt';
import type { Candidate, Eval, OwnedIndexName } from '../../core/types';
import { asOwnedIndexName } from '../../core/types';

/**
 * Adversarial eval responses: all equal, exactly minImprovementFactor, ±ε.
 */
export function genEvalResponses(
  candidates: readonly Candidate[],
  minImprovementFactor: number
): fc.Arbitrary<ReadonlyMap<string, Eval>> {
  return fc
    .constantFrom('all_equal', 'exact_min', 'below_min', 'above_min', 'mixed')
    .map((mode) => {
      const map = new Map<string, Eval>();
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i]!;
        let improvement = minImprovementFactor;
        if (mode === 'all_equal') improvement = minImprovementFactor;
        else if (mode === 'exact_min') improvement = minImprovementFactor;
        else if (mode === 'below_min')
          improvement = Math.max(1, minImprovementFactor - 0.001);
        else if (mode === 'above_min')
          improvement = minImprovementFactor + 0.001;
        else improvement = i % 2 === 0 ? minImprovementFactor + 1 : 1;
        map.set(c.name, makeEval(c.name, improvement));
      }
      return map;
    });
}

function makeEval(name: OwnedIndexName | string, improvement: number): Eval {
  return {
    candidateName: asOwnedIndexName(String(name)),
    improvement,
    baselineCost: 1000,
    withIndexCost: 1000 / Math.max(improvement, 0.001),
    lowConfidence: false,
  };
}

export const genMinImprovementFactor = fc.constantFrom(1, 2, 3, 5, 10);
