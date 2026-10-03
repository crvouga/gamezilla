import { expect } from 'bun:test';
import { playUntilSolved } from '@libs/chess/harness/chess-actions';
import { NAMED_PUZZLES } from '@libs/chess/harness/puzzle-fixtures';
import {
  configurePuzzleSounds,
  readPuzzleSoundsOn,
} from '@libs/chess/harness/puzzle-sound-preference';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import {
  markPuzzleSoundBoundary,
  recentPuzzleSounds,
} from './puzzle-sound-evidence';
import { enterNamedPuzzle } from './puzzle-world';

Given('{actor} has turned sounds on', (w, actor: Actor) =>
  w.s.apply(configurePuzzleSounds, actor, true)
);
Given('{actor} has turned sounds off', (w, actor: Actor) =>
  w.s.apply(configurePuzzleSounds, actor, false)
);
Given(
  '{actor} has since turned sounds off and returned to that unfinished puzzle',
  (w, actor: Actor) => w.s.apply(configurePuzzleSounds, actor, false)
);
Given(
  '{actor} has since turned sounds on and returned to that unfinished puzzle',
  (w, actor: Actor) => w.s.apply(configurePuzzleSounds, actor, true)
);
Given('{actor} has solved the en passant puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.enPassant);
  await w.s.apply(playUntilSolved, actor);
  await w.s.advanceTime(1000);
});
When('{actor} turns sounds off', async (w, actor: Actor) => {
  await markPuzzleSoundBoundary(w, actor);
  await w.s.apply(configurePuzzleSounds, actor, false);
});
When('{actor} turns sounds on', async (w, actor: Actor) => {
  await markPuzzleSoundBoundary(w, actor);
  await w.s.apply(configurePuzzleSounds, actor, true);
});
Then('{actor} hears no new puzzle feedback', async (w, actor: Actor) =>
  expect(await recentPuzzleSounds(w, actor)).toEqual([])
);
Then("{actor}'s sounds are off", async (w, actor: Actor) =>
  expect(await w.s.read(readPuzzleSoundsOn, actor)).toBe(false)
);
Then("{actor}'s sounds are on", async (w, actor: Actor) =>
  expect(await w.s.read(readPuzzleSoundsOn, actor)).toBe(true)
);
Then("{actor} hears the puzzle's move sounds", async (w, actor: Actor) =>
  expect(await recentPuzzleSounds(w, actor)).toEqual([
    'move',
    'puzzleCorrectMove',
  ])
);
Then("{actor} hears the puzzle's capture sound", async (w, actor: Actor) =>
  expect((await recentPuzzleSounds(w, actor)).toSorted()).toEqual([
    'capture',
    'promote',
    'puzzleCheckmate',
  ])
);
Then("{actor} hears the review's move sound", async (w, actor: Actor) =>
  expect(await recentPuzzleSounds(w, actor)).toEqual([
    'move',
    'check',
    'gameEnd',
  ])
);
Then(
  "{actor} hears the puzzle's wrong-move feedback",
  async (w, actor: Actor) =>
    expect(
      (await recentPuzzleSounds(w, actor)).filter((name) => name === 'illegal')
    ).toEqual(['illegal'])
);
Then(
  "{actor} cannot hear puzzle sounds while the app's sounds are off",
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSoundsOn, actor)).toBe(false);
    expect(await recentPuzzleSounds(w, actor)).toEqual([]);
  }
);
