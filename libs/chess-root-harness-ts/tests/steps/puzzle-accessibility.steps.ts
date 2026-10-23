/**
 * Puzzles with the keyboard alone and by listening: what the puzzle's live
 * region says, and every puzzle control and move done from the keyboard.
 */

import { expect } from 'bun:test';
import type { PuzzleHeard } from '@libs/chess-puzzle-harness-ts/puzzle-keyboard';
import {
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  readPuzzleHeard,
} from '@libs/chess-puzzle-harness-ts/puzzle-keyboard';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { SETTLE_MS, uciOf, waitSolverToMove } from './puzzle-world';

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
  '{actor} hears the hint names the {word} on {word}',
  async (w, actor: Actor, piece: string, square: string) => {
    await hears(w, actor, ['Hint', `${piece} on ${square}`]);
  }
);

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
