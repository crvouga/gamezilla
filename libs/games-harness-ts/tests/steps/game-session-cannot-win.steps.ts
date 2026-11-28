/**
 * A game session where the second side cannot win, along the game's known
 * line to such a position (`cannot-win-world`).
 */

import { inMatchedGame } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { readGameSessionTime } from '@libs/game-session-harness-ts/game-session-clocks';
import type { GameSessionLineup } from '@libs/game-session-harness-ts/game-session-lineup';
import { makeGameSessionMove } from '@libs/game-session-harness-ts/game-session-moves';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionTimeLeft } from '@libs/game-session-shared-ts/game-session-state';
import { Given } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { cannotWinLine, matchedTimeLeft } from './cannot-win-world';
import { clockChoice, current } from './game-session-set-up-world';
import { gameOf, setupGameSession } from './game-world';

const SECOND_MS = 1000;
/** Who plays the first side, who makes the line's last move. */
const FIRST_SIDE = 'game-session-first-side';

async function cannotWinGame(
  w: HarnessWorld,
  lineup: GameSessionLineup
): Promise<void> {
  await setupGameSession(w, {
    ...lineup,
    moves: cannotWinLine(w).slice(0, -1),
  });
  w.memo.set(FIRST_SIDE, lineup.first ?? 'alice');
}

Given(
  '{actor} and {actor} have a game session played at {word} where the second side cannot win',
  async (w, _first: string, _second: string, clock: string) =>
    cannotWinGame(w, { clock: clockChoice(clock) })
);
Given(
  '{actor} and {actor} have a game session under way where the second side cannot win',
  async (w) => cannotWinGame(w, {})
);
Given(
  '{actor} hosts a game session under way with {actor} on the first side where the second side cannot win',
  async (w, host: string, first: string) =>
    cannotWinGame(w, { host, first, second: host })
);
// The second side's clock runs once the first side makes the line's last
// move, which leaves the second side still unable to win.
Given(
  'the {gameSide} has one second left',
  async (w, side: GameSessionSide) => {
    if (inMatchedGame(w)) return matchedTimeLeft(w, side, SECOND_MS);
    if (side === 'black')
      await w.s.apply(
        makeGameSessionMove,
        String(w.memo.get(FIRST_SIDE)),
        gameOf(w).shared.id,
        cannotWinLine(w).at(-1)
      );
    const game = await current(w);
    await w.s.advanceTime(
      gameSessionTimeLeft(game, side, await w.s.read(readGameSessionTime)) -
        SECOND_MS
    );
  }
);
