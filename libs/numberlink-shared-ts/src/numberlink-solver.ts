import { validateNumberlinkDefinition } from './numberlink-definition';
import { createSearch, searchPairs } from './numberlink-solver-search';
import type { NumberlinkIssue, NumberlinkState } from './numberlink-types';

export type NumberlinkSolveResult =
  | { readonly status: 'invalid'; readonly issues: readonly NumberlinkIssue[] }
  | { readonly status: 'unsolvable' | 'inconclusive'; readonly nodes: number }
  | {
      readonly status: 'solved';
      readonly solution: NumberlinkState;
      readonly uniqueness: 'unique' | 'multiple' | 'unknown';
      readonly nodes: number;
    };

export type NumberlinkSolveOptions = {
  readonly maxNodes?: number;
  readonly checkUniqueness?: boolean;
};

/** Work is bounded by visited states, never elapsed time, on every host. */
export function solveNumberlink(
  input: unknown,
  options: NumberlinkSolveOptions = {}
): NumberlinkSolveResult {
  const checked = validateNumberlinkDefinition(input);
  if (!checked.valid) return { status: 'invalid', issues: checked.issues };
  const maxNodes = options.maxNodes ?? 50_000;
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw new Error('Numberlink maxNodes must be a positive safe integer');
  const search = createSearch(
    checked.value,
    maxNodes,
    options.checkUniqueness === true ? 2 : 1
  );
  searchPairs(search, []);
  const solution = search.solutions[0];
  if (solution === undefined)
    return {
      status: search.exhausted ? 'inconclusive' : 'unsolvable',
      nodes: search.nodes,
    };
  const uniqueness =
    search.solutions.length > 1
      ? 'multiple'
      : options.checkUniqueness === true && !search.exhausted
        ? 'unique'
        : 'unknown';
  return { status: 'solved', solution, uniqueness, nodes: search.nodes };
}
