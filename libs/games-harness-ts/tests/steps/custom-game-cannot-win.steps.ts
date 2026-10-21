/**
 * A custom game where the second side cannot win, along the game's known
 * line to such a position (`cannot-win-world`).
 */

import { inMatchedGame } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { readCustomGameTime } from '@libs/game-session-harness-ts/custom-game-clocks';
import type { CustomGameLineup } from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { customGameTimeLeft } from '@libs/game-session-shared-ts/custom-game-state';
import { Given } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { cannotWinLine, matchedTimeLeft } from './cannot-win-world';
import { clockChoice, current } from './custom-game-set-up-world';
import { gameOf, setupCustomGame } from './game-world';

const SECOND_MS = 1000;
/** Who plays the first side, who makes the line's last move. */
const FIRST_SIDE = 'custom-game-first-side';

async function cannotWinGame(
  w: HarnessWorld,
  lineup: CustomGameLineup
): Promise<void> {
  await setupCustomGame(w, { ...lineup, moves: cannotWinLine(w).slice(0, -1) });
  w.memo.set(FIRST_SIDE, lineup.first ?? 'alice');
}

Given(
  '{actor} and {actor} have a custom game played at {word} where the second side cannot win',
  async (w, _first: string, _second: string, clock: string) =>
    cannotWinGame(w, { clock: clockChoice(clock) })
);
Given(
  '{actor} and {actor} have a custom game under way where the second side cannot win',
  async (w) => cannotWinGame(w, {})
);
Given(
  '{actor} hosts a custom game under way with {actor} on the first side where the second side cannot win',
  async (w, host: string, first: string) =>
    cannotWinGame(w, { host, first, second: host })
);
// The second side's clock runs once the first side makes the line's last
// move, which leaves the second side still unable to win.
Given('the {gameSide} has one second left', async (w, side: CustomGameSide) => {
  if (inMatchedGame(w)) return matchedTimeLeft(w, side, SECOND_MS);
  if (side === 'black')
    await w.s.apply(
      makeCustomGameMove,
      String(w.memo.get(FIRST_SIDE)),
      gameOf(w).shared.id,
      cannotWinLine(w).at(-1)
    );
  const game = await current(w);
  await w.s.advanceTime(
    customGameTimeLeft(game, side, await w.s.read(readCustomGameTime)) -
      SECOND_MS
  );
});
