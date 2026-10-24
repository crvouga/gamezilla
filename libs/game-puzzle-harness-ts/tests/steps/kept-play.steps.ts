import { expect } from 'bun:test';
import {
  arrangePersonalAttempt,
  finishContentAttempt,
} from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import { earlierAttemptResumed } from '@libs/game-puzzle-harness-ts/attempt-observations';
import { contentNotice } from '@libs/game-puzzle-harness-ts/content-observations';
import { startPublishedPackPuzzle } from '@libs/game-puzzle-harness-ts/pack-play-actions';
import {
  currentPackProgress,
  rememberedPositionRestored,
} from '@libs/game-puzzle-harness-ts/pack-progress-observations';
import { resumeEarlierContentAttempt } from '@libs/game-puzzle-harness-ts/retained-content-actions';
import { Given, Then, When } from './world';

Given(
  'Bob has completed {string} and {string} in the published pack {string}',
  async (w, first: string, second: string, pack: string) => {
    await w.run.apply(arrangePersonalAttempt, {
      title: first,
      pack,
      puzzles: `${first}, ${second}`,
      completed: true,
    });
    await w.run.apply(startPublishedPackPuzzle, 'bob:phone', second, pack);
    await w.run.apply(finishContentAttempt, 'bob:phone');
  }
);

When('Bob resumes his earlier puzzle attempt', async (w) => {
  await w.run.apply(resumeEarlierContentAttempt, 'bob:phone');
});

Then(
  'Bob has the same unfinished puzzle position in that earlier attempt',
  async (w) => {
    expect(await w.run.read(earlierAttemptResumed, 'bob:phone')).toBe(true);
    expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(
      true
    );
  }
);

Then('Bob is told there is no later puzzle position', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe('PUZZLE_NO_REDO');
});

Then('Bob is not offered an unfinished puzzle', async (w) => {
  expect(await w.run.read(currentPackProgress, 'bob:phone')).toMatchObject({
    next: null,
  });
});
