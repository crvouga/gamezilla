/**
 * A puzzle of the run's game won another way: the known puzzle whose
 * author wrote a winning move off its line, on the board alone in the
 * pool, won that way online, offline, or both ways on two devices apart.
 */

import { winGamePuzzleApartBothWays } from '@libs/game-session-harness-ts/puzzle-finishes';
import {
  puzzleWonAnotherWay,
  winKnownPuzzleAnotherWay,
} from '@libs/game-session-harness-ts/puzzle-moves';
import { readPuzzleState } from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { gameOf } from './game-world';
import {
  enterPuzzles,
  focusPuzzle,
  puzzleGameId,
  SETTLE_MS,
  writePool,
} from './puzzle-world';

Given(
  "{actor} is solving the game's known puzzle that can be won another way",
  async (w, actor: Actor) => {
    const fixture = puzzleWonAnotherWay(gameOf(w));
    await writePool(w, [{ id: fixture.record.id }]);
    const id = await enterPuzzles(w, actor);
    // Precondition guard: the feed served it, the one puzzle in the pool.
    if (id !== fixture.record.id)
      throw new Error(`${actor} was served ${id}, not ${fixture.record.id}`);
  }
);

When('{actor} plays the other winning last move', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(winKnownPuzzleAnotherWay, actor, puzzleGameId(w));
});

Given(
  '{actor} has won the puzzle another way offline',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await focusPuzzle(w, actor);
    await w.s.apply(winKnownPuzzleAnotherWay, actor, puzzleGameId(w));
    // Precondition guard: the board counts it solved, offline.
    await w.s.until((surf) => readPuzzleState(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (state) => state === 'solved',
    });
  }
);

Given(
  '{actor} has won the puzzle a different way on each device offline',
  async (w, actor: Actor) => {
    await w.s.apply(
      winGamePuzzleApartBothWays,
      actor,
      otherDevice(actor),
      puzzleGameId(w)
    );
  }
);
