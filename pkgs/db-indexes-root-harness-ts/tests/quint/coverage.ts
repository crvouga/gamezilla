import type { ItfState, ItfTrace } from '@pkgs/quint-shared-ts/itf';

function tuningTransitions(
  previous: ItfState,
  state: ItfState,
  covered: Set<string>
): void {
  const retired = previous.vars['retiring'] as ReadonlySet<string>;
  const currentRetired = state.vars['retiring'] as ReadonlySet<string>;
  const currentIndexed = state.vars['indexed'] as ReadonlySet<string>;
  const priorIndexed = previous.vars['indexed'] as ReadonlySet<string>;
  if (
    [...retired].some(
      (lookup) => !currentRetired.has(lookup) && currentIndexed.has(lookup)
    )
  )
    covered.add('retirement cancelled');
  if ([...currentRetired].some((lookup) => !retired.has(lookup)))
    covered.add('retirement started');
  if ([...currentIndexed].some((lookup) => !priorIndexed.has(lookup)))
    covered.add('creation');
}

export function retirementCoverage(traces: readonly ItfTrace[]): string[] {
  const covered = new Set<string>();
  for (const trace of traces) {
    for (const [index, state] of trace.states.entries()) {
      const previous = trace.states[index - 1];
      if (
        (state.vars['_dropEvidence'] as ReadonlyMap<string, unknown>).size > 0
      )
        covered.add('removal');
      if ((state.vars['_held'] as ReadonlySet<string>).size > 0)
        covered.add('usage hold');
      if (previous === undefined || state.action !== 'tune') continue;
      tuningTransitions(previous, state, covered);
    }
  }
  return [...covered].sort();
}

export function interruptionCoverage(traces: readonly ItfTrace[]): string[] {
  const covered = new Set<string>();
  for (const trace of traces) {
    for (const [index, state] of trace.states.entries()) {
      const previous = trace.states[index - 1];
      if (state.action === 'attempt')
        covered.add(`attempt:${String(state.picks['outcome'])}`);
      if (state.action === 'recover' && previous !== undefined)
        covered.add(`recover:${String(previous.vars['state'])}`);
      if (state.action === 'repeat') covered.add('repeat');
    }
  }
  return [...covered].sort();
}
