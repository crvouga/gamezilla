import { expect } from 'bun:test';
import { restartContentAttempt } from '@libs/game-puzzle-harness-ts/attempt-actions';
import {
  arrangePersonalAttempt,
  finishContentAttempt,
} from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import { currentAttemptView } from '@libs/game-puzzle-harness-ts/attempt-observations';
import {
  continuePublishedPack,
  openPublishedPack,
  startPublishedPackPuzzle,
} from '@libs/game-puzzle-harness-ts/pack-play-actions';
import {
  currentPackProgress,
  namedPackProgress,
  rememberedPositionRestored,
} from '@libs/game-puzzle-harness-ts/pack-progress-observations';
import { Given, Then, When } from './world';

Given('Bob has restarted the puzzle {string}', async (w, _title: string) => {
  await w.run.apply(restartContentAttempt, 'bob:phone');
});

Given(
  'Bob is playing {string} in the published pack {string} containing {string}',
  async (w, title: string, pack: string, puzzles: string) => {
    await w.run.apply(arrangePersonalAttempt, {
      title,
      pack,
      puzzles,
      fresh: true,
    });
  }
);

Given(
  'Bob has completed {string} in the published pack {string} containing {string}',
  async (w, title: string, pack: string, puzzles: string) => {
    await w.run.apply(arrangePersonalAttempt, {
      title,
      pack,
      puzzles,
      completed: true,
    });
  }
);

Given(
  'Bob has unfinished play at {string} in the published pack {string}',
  async (w, title: string, pack: string) => {
    await w.run.apply(arrangePersonalAttempt, { title, pack });
  }
);

Given(
  'Bob has completed {string} and is playing {string} in the published pack {string}',
  async (w, completed: string, title: string, pack: string) => {
    await w.run.apply(arrangePersonalAttempt, {
      title: completed,
      pack,
      completed: true,
    });
    await w.run.apply(startPublishedPackPuzzle, 'bob:phone', title, pack);
  }
);

Given(
  "Bob has a saved attempt from Alice's published pack {string}",
  async (w, pack: string) => {
    await w.run.apply(arrangePersonalAttempt, { title: 'River', pack });
  }
);

When('Bob opens that published pack', async (w) => {
  await w.run.apply(openPublishedPack, 'bob:phone', 'Rivers');
});

When('Bob completes that puzzle', async (w) => {
  await w.run.apply(finishContentAttempt, 'bob:phone');
});

When('Bob continues the pack {string}', async (w, pack: string) => {
  await w.run.apply(continuePublishedPack, pack);
});

When(
  'Bob starts {string} from the pack {string}',
  async (w, title: string, pack: string) => {
    await w.run.apply(startPublishedPackPuzzle, 'bob:phone', title, pack);
  }
);

When('Bob returns to the pack overview', async (w) => {
  await w.run.apply(openPublishedPack, 'bob:phone', 'Rivers');
});

Then('Bob sees two unplayed puzzles and no completed puzzles', async (w) => {
  expect(await w.run.read(currentPackProgress, 'bob:phone')).toMatchObject({
    total: 2,
    completedCount: 0,
    items: [{ status: 'unplayed' }, { status: 'unplayed' }],
  });
});

Then(
  'Bob sees one completed puzzle out of two in {string}',
  async (w, pack: string) => {
    expect(
      await w.run.read(namedPackProgress, 'bob:phone', pack)
    ).toMatchObject({ total: 2, completedCount: 1 });
  }
);

Then(
  'Bob sees two completed puzzles out of two in {string}',
  async (w, pack: string) => {
    expect(
      await w.run.read(namedPackProgress, 'bob:phone', pack)
    ).toMatchObject({ total: 2, completedCount: 2 });
  }
);

Then('Bob is offered {string} as the next puzzle', async (w, title: string) => {
  expect(await w.run.read(currentPackProgress, 'bob:phone')).toMatchObject({
    next: { title },
  });
});

Then('Bob resumes his saved position at {string}', async (w, title: string) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    title,
  });
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});

Then('Bob can play {string}', async (w, title: string) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    title,
    complete: false,
  });
});

Then('{string} remains unplayed', async (w, title: string) => {
  expect(
    (await w.run.read(currentPackProgress, 'bob:phone'))?.items
  ).toContainEqual(expect.objectContaining({ title, status: 'unplayed' }));
});

Then('Bob sees that the pack {string} is complete', async (w, pack: string) => {
  expect(await w.run.read(namedPackProgress, 'bob:phone', pack)).toMatchObject({
    complete: true,
  });
});

Then(
  'Bob sees that the pack {string} is unfinished',
  async (w, pack: string) => {
    expect(
      await w.run.read(namedPackProgress, 'bob:phone', pack)
    ).toMatchObject({ complete: false });
  }
);

Then('Bob can resume that saved attempt', async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});
