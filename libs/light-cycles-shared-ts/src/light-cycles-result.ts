import type { LightCyclesResult, LightCyclesState } from './light-cycles-state';

export function lightCyclesResult(
  state: LightCyclesState
): LightCyclesResult | null {
  return state.result;
}

/** The framework's view: a round's result pause is still a running match. */
export function lightCyclesPhase(
  state: LightCyclesState
): 'countdown' | 'running' | 'completed' {
  if (state.phase === 'round-over') return 'running';
  return state.phase;
}

export function lightCyclesRound(state: LightCyclesState): number {
  return state.round;
}

/** Changes exactly when the round, a score or the match result changes. */
export function lightCyclesCheckpointKey(state: LightCyclesState): string {
  const result =
    state.result === null
      ? '-'
      : `${state.result.winner}:${state.result.reason}`;
  return `${state.round}|${state.scores.join(',')}|${result}`;
}
