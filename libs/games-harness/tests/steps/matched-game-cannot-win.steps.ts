/**
 * Running out of time in a matched game where the second side cannot win,
 * along the game's known line to such a position (`cannot-win-world`).
 */

import { expect } from 'bun:test';
import { bothBoards } from '@libs/game-matchmaking-harness/matched-game-world';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Given, Then } from '@libs/harness/define';
import { cannotWinMatchedGame, matchedTimeLeft } from './cannot-win-world';
import { daily } from './finding-an-opponent-world';

const DAY_MS = 86_400_000;

Given(
  '{actor} has the first side against {actor} in a {word} matched game where the second side cannot win',
  (w, first: string, second: string, clock: string) =>
    cannotWinMatchedGame(w, [first, second], clock)
);
Given(
  '{actor} has the first side against {actor} in a daily game at {int} day(s) per move where the second side cannot win',
  (w, first: string, second: string, days: number) =>
    cannotWinMatchedGame(w, [first, second], daily(days))
);
Given('the {gameSide} has one day left', (w, side: CustomGameSide) =>
  matchedTimeLeft(w, side, DAY_MS)
);

Then(
  'both people see the matched game is drawn because the first side ran out of time',
  async (w) => {
    const game = await bothBoards(w, (g) => g.outcome !== 'ongoing');
    expect(game.outcome).toBe('draw');
    expect(game.white_ms).toBe(0);
  }
);
