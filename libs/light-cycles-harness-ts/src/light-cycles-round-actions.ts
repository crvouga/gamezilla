import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { lightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  type LightCyclesState,
  lightCyclesRoundStart,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { restoreLightCyclesArena } from './light-cycles-arena-fixture';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesBoardShown,
  type LightCyclesRiderName,
  lightCyclesBoardShown,
} from './light-cycles-board-view';
import { lightCyclesObserver, startedLightCycles } from './light-cycles-lineup';

const SHOWN_MS = 2000;

/** The score as the arena shows it: round wins in seat order, and the round. */
function scoreHolds(
  board: LightCyclesBoardShown,
  wins: readonly number[],
  round: number
): boolean {
  return (
    board.round === round &&
    board.phase === 'countdown' &&
    board.riders.every((rider, index) => rider.score === (wins[index] ?? 0))
  );
}

/** A fresh countdown of `round` with the score at `wins`: the authority's own next-round arena. */
function countdownOf(
  saved: LightCyclesState,
  wins: readonly number[],
  round: number
): LightCyclesState {
  const scores = saved.seats.map((_, index) => wins[index] ?? 0);
  const best = Math.max(...scores);
  const leader = saved.seats[scores.indexOf(best)]!;
  return {
    ...saved,
    phase: 'countdown',
    phaseTick: 0,
    round,
    ...lightCyclesRoundStart(saved.seats, lightCyclesConfig(), round),
    scores,
    // The round before was won by a leader, or drawn when fewer rounds were won than played.
    roundWinner:
      round === 1
        ? null
        : scores.reduce((sum, score) => sum + score, 0) < round - 1
          ? 'draw'
          : leader,
    result: null,
    crashes: [],
  };
}

/**
 * The game is under way with each rider on `wins` round wins after `rounds`
 * rounds (as many as were won, unless named), its next round counting down.
 * A game that shows exactly that already stays as it is; otherwise it
 * resumes from its saved live state holding that score.
 */
export const arrangeRoundWins = scenarioAction({
  name: 'arrangeRoundWins',
  act: async (
    s,
    score: Partial<Record<LightCyclesRiderName, number>>,
    rounds?: number
  ) => {
    await startedLightCycles(s);
    const wins = LIGHT_CYCLES_RIDER_NAMES.map((name) => score[name] ?? 0);
    const played = rounds ?? wins.reduce((sum, won) => sum + won, 0);
    const host = lightCyclesObserver(s);
    if (scoreHolds(await lightCyclesBoardShown(s, host), wins, played + 1))
      return;
    await restoreLightCyclesArena(s, (saved) =>
      countdownOf(saved, wins, played + 1)
    );
    await pollUntil(
      s,
      async () =>
        scoreHolds(await lightCyclesBoardShown(s, host), wins, played + 1)
          ? true
          : null,
      { maxMs: SHOWN_MS, stepMs: 10, description: 'the arranged score' }
    );
  },
});
