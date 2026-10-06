/**
 * Puzzles with the keyboard alone and by listening: what the puzzle's live
 * region says, and every puzzle control and move done from the keyboard.
 */

import { expect } from 'bun:test';
import type { PuzzleHeard } from '@libs/chess-puzzle-harness/puzzle-keyboard';
import {
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  readPuzzleHeard,
  usePuzzleControlWithKeyboard,
} from '@libs/chess-puzzle-harness/puzzle-keyboard';
import { readShownRatingChange } from '@libs/chess-puzzle-harness/puzzle-outcome-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  required,
  SETTLE_MS,
  trackPuzzle,
  uciOf,
  waitSolverToMove,
} from './puzzle-world';

/** What the actor hears once it says `words` (every one of them). */
async function hears(
  w: HarnessWorld,
  actor: Actor,
  words: readonly string[]
): Promise<PuzzleHeard> {
  await w.s.apply(focusActor, actor);
  const heard = await w.s.until((surf) => readPuzzleHeard(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (now) => words.every((word) => now.words.includes(word)),
  });
  expect(heard.problems).toEqual([]);
  return heard;
}

/** `a7-a6` as it is said: `a7 to a6`. */
function spoken(move: string): string {
  const uci = uciOf(move);
  return `${uci.slice(0, 2)} to ${uci.slice(2, 4)}`;
}

// --------------------------------------------------------------- listening

Given('{actor} is listening to the app', async (w, actor: Actor) => {
  await w.s.apply(listenToTheApp, actor);
});

Then(
  '{actor} hears the setup move {word}',
  async (w, actor: Actor, move: string) => {
    await hears(w, actor, ['Setup move', spoken(move)]);
  }
);

Then(
  '{actor} hears that {word} is to move',
  async (w, actor: Actor, side: string) => {
    await hears(w, actor, [`${side} to move`]);
  }
);

Then(
  "{actor} hears the opponent's reply {word}",
  async (w, actor: Actor, move: string) => {
    await hears(w, actor, ["Opponent's reply", spoken(move)]);
  }
);

Then(
  '{actor} hears in words that the move was wrong',
  async (w, actor: Actor) => {
    await hears(w, actor, ['Wrong move']);
  }
);

Then('{actor} hears the puzzle is solved', async (w, actor: Actor) => {
  await hears(w, actor, ['Puzzle solved']);
});

Then(
  '{actor} hears the hint names the {word} on {word}',
  async (w, actor: Actor, piece: string, square: string) => {
    await hears(w, actor, ['Hint', `${piece} on ${square}`]);
  }
);

Then('{actor} hears their rating change', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  const shown = required(
    await w.s.until((surf) => readShownRatingChange(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (change) => change !== null,
    }),
    `${actor}'s rating change`
  );
  const said = {
    raised: 'went up by',
    lowered: 'went down by',
    unchanged: 'stayed at',
    unrated: 'unrated',
  } as const;
  await hears(w, actor, [said[shown]]);
});

// ---------------------------------------------------------------- keyboard

Given(
  '{actor} has played {word} with the keyboard',
  async (w, actor: Actor, move: string) => {
    await waitSolverToMove(w, actor);
    await w.s.apply(playPuzzleMoveWithKeyboard, actor, uciOf(move));
  }
);

When(
  '{actor} plays the move {word} with the keyboard',
  async (w, actor: Actor, move: string) => {
    await waitSolverToMove(w, actor);
    await w.s.apply(playPuzzleMoveWithKeyboard, actor, uciOf(move));
  }
);

When('{actor} asks for a hint with the keyboard', async (w, actor: Actor) => {
  await w.s.apply(usePuzzleControlWithKeyboard, actor, 'hint');
});

When(
  '{actor} retries the puzzle with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'retry');
  }
);

When(
  '{actor} shows the solution with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'solution');
  }
);

When('{actor} skips the puzzle with the keyboard', async (w, actor: Actor) => {
  await w.s.apply(usePuzzleControlWithKeyboard, actor, 'skip');
});

When(
  '{actor} moves on to the next puzzle with the keyboard',
  async (w, actor: Actor) => {
    await w.s.apply(usePuzzleControlWithKeyboard, actor, 'next');
    await trackPuzzle(w, actor);
  }
);
