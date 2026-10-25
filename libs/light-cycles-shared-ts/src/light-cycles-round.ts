import type { LightCyclesConfig, LightCyclesSeat } from './light-cycles-config';
import {
  type LightCyclesResult,
  type LightCyclesState,
  lightCyclesRoundStart,
} from './light-cycles-state';

/** The single highest scorer, or a draw between equal leaders. */
export function lightCyclesLeader(
  state: Pick<LightCyclesState, 'seats' | 'scores'>
): LightCyclesSeat | 'draw' {
  const best = Math.max(...state.scores);
  const leaders = state.seats.filter(
    (_, index) => state.scores[index] === best
  );
  return leaders.length === 1 ? leaders[0]! : 'draw';
}

function matchResult(
  state: LightCyclesState,
  winner: LightCyclesSeat | 'draw'
): LightCyclesResult | null {
  if (winner !== 'draw') {
    const score = state.scores[state.seats.indexOf(winner)] ?? 0;
    if (score >= state.targetScore) return { winner, reason: 'target score' };
  }
  if (state.round >= state.maxRounds)
    return { winner: lightCyclesLeader(state), reason: 'round limit' };
  return null;
}

/** Scores a finished round once: the lone survivor wins it, nobody left is a draw. */
export function finishLightCyclesRound(
  state: LightCyclesState
): LightCyclesState {
  const alive = state.riders.filter((rider) => rider.alive);
  if (alive.length > 1) return state;
  const winner = alive.length === 1 ? alive[0]!.seat : 'draw';
  const scored: LightCyclesState = {
    ...state,
    phaseTick: 0,
    riders: state.riders.map((rider) =>
      rider.turns.length === 0 ? rider : { ...rider, turns: [] }
    ),
    scores: state.scores.map((score, index) =>
      state.seats[index] === winner ? score + 1 : score
    ),
    roundWinner: winner,
  };
  const result = matchResult(scored, winner);
  return result === null
    ? { ...scored, phase: 'round-over' }
    : { ...scored, phase: 'completed', result };
}

/** A fresh arena for the next round; scores carry over. */
export function startNextLightCyclesRound(
  state: LightCyclesState,
  config: Pick<LightCyclesConfig, 'width' | 'height'>
): LightCyclesState {
  const round = state.round + 1;
  return {
    ...state,
    phase: 'countdown',
    phaseTick: 0,
    round,
    ...lightCyclesRoundStart(state.seats, config, round),
    crashes: [],
  };
}
