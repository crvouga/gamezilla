import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  configureSounds,
  readSoundsOn,
} from '@libs/harness-ts/sounds-preference';
import { recentPuzzleSounds } from './puzzle-sound-evidence';

Given(
  '{actor} has since turned sounds on and returned to that unfinished puzzle',
  (w, actor: Actor) => w.s.apply(configureSounds, actor, true)
);
Then("{actor} hears the puzzle's capture sound", async (w, actor: Actor) =>
  expect((await recentPuzzleSounds(w, actor)).toSorted()).toEqual([
    'capture',
    'promote',
    'puzzleCheckmate',
  ])
);
Then(
  "{actor} cannot hear puzzle sounds while the app's sounds are off",
  async (w, actor: Actor) => {
    expect(await w.s.read(readSoundsOn, actor)).toBe(false);
    expect(await recentPuzzleSounds(w, actor)).toEqual([]);
  }
);
