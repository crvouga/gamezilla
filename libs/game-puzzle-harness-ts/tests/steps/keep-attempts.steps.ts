import { expect } from 'bun:test';
import {
  changeContentAttempt,
  openOtherAttempt,
  restartContentAttempt,
  startStandaloneAttempt,
} from '@libs/game-puzzle-harness-ts/attempt-actions';
import { arrangePersonalAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import {
  currentAttemptView,
  earlierAttemptVisible,
  ordinaryAttemptTitles,
  ordinaryCompletionTitles,
} from '@libs/game-puzzle-harness-ts/attempt-observations';
import {
  contentDiscoverable,
  contentNotice,
} from '@libs/game-puzzle-harness-ts/content-observations';
import { reopenContentDevice } from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  rememberedEditionKept,
  rememberedPositionRestored,
} from '@libs/game-puzzle-harness-ts/pack-progress-observations';
import { Given, Then, When } from './world';

Given(
  'Bob has made progress in the published puzzle {string}',
  async (w, title: string) => {
    await w.run.apply(arrangePersonalAttempt, { title });
  }
);

Given(
  'Bob has completed the published puzzle {string}',
  async (w, title: string) => {
    await w.run.apply(arrangePersonalAttempt, { title, completed: true });
  }
);

Given('Bob has made progress in a puzzle offering undo and redo', async (w) => {
  await w.run.apply(arrangePersonalAttempt, { title: 'River' });
});

Given(
  'Bob has a fresh attempt in a puzzle offering undo and redo',
  async (w) => {
    await w.run.apply(arrangePersonalAttempt, { title: 'River', fresh: true });
  }
);

Given('Bob has undone a puzzle action', async (w) => {
  await w.run.apply(arrangePersonalAttempt, { title: 'River' });
  await w.run.apply(changeContentAttempt, 'bob:phone', { kind: 'undo' });
});

When('Bob starts the standalone puzzle {string}', async (w, title: string) => {
  await w.run.apply(startStandaloneAttempt, 'bob:phone', { title });
});

When('Bob reopens the app', async (w) => {
  await w.run.apply(reopenContentDevice, 'bob:phone');
});

When("Alice opens Bob's saved puzzle attempt", async (w) => {
  await w.run.apply(openOtherAttempt);
});

When('Bob undoes his last puzzle action', async (w) => {
  await w.run.apply(changeContentAttempt, 'bob:phone', { kind: 'undo' });
});

When('Bob redoes that puzzle action', async (w) => {
  await w.run.apply(changeContentAttempt, 'bob:phone', { kind: 'redo' });
});

When('Bob plays a different puzzle action', async (w) => {
  await w.run.apply(changeContentAttempt, 'bob:phone', {
    kind: 'play',
    action: 'step2',
  });
});

When('Bob restarts that puzzle', async (w) => {
  await w.run.apply(restartContentAttempt, 'bob:phone');
});

Then(
  'Bob has an unfinished attempt at the published edition {string}',
  async (w, title: string) => {
    expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
      title,
      complete: false,
      mode: 'ordinary',
    });
  }
);

Then('Bob is told that puzzle is not available', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe(
    'PUZZLE_UNAVAILABLE'
  );
});

Then('Bob has no ordinary attempt at {string}', async (w, title: string) => {
  expect(await w.run.read(ordinaryAttemptTitles, 'bob:phone')).not.toContain(
    title
  );
});

Then('Bob has the same unfinished puzzle position', async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    complete: false,
  });
});

Then('Alice is told that puzzle attempt is private', async (w) => {
  expect(await w.run.read(contentNotice, 'alice:phone')).toBe('private');
});

Then("Alice cannot read Bob's puzzle position", async (w) => {
  expect(await w.run.read(currentAttemptView, 'alice:phone')).toBeNull();
});

Then('Bob sees the preceding puzzle position', async (w) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    state: 'count:0',
  });
});

Then('Bob can redo that puzzle action', async (w) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    canRedo: true,
  });
});

Then('Bob sees the position before his undo', async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});

Then('Bob is told there is no earlier puzzle position', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe(
    'PUZZLE_NO_EARLIER_POSITION'
  );
});

Then("Bob's fresh puzzle position is unchanged", async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});

Then('Bob cannot redo the replaced puzzle action', async (w) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    canRedo: false,
  });
});

Then("Bob's new puzzle position is kept", async (w) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    state: 'count:2',
  });
});

Then('Bob has a fresh attempt at the same puzzle edition', async (w) => {
  expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    state: 'count:0',
    complete: false,
  });
  expect(await w.run.read(rememberedEditionKept, 'bob:phone')).toBe(true);
});

Then('Bob can still open his earlier attempt', async (w) => {
  expect(await w.run.read(earlierAttemptVisible, 'bob:phone')).toBe(true);
});

Then(
  "{string} remains completed in Bob's progress",
  async (w, title: string) => {
    expect(await w.run.read(ordinaryCompletionTitles, 'bob:phone')).toContain(
      title
    );
  }
);

Then(
  'Bob can resume the same position at the earlier edition {string}',
  async (w, title: string) => {
    expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(
      true
    );
    expect(await w.run.read(currentAttemptView, 'bob:phone')).toMatchObject({
      title,
    });
  }
);

Then(
  'Bob can start the current puzzle edition {string} separately',
  async (w, title: string) => {
    expect(
      await w.run.until((s) => contentDiscoverable(s, 'bob:phone', title), {
        pred: Boolean,
        maxMs: 5000,
      })
    ).toBe(true);
    expect(await w.run.read(currentAttemptView, 'bob:phone')).not.toMatchObject(
      { title }
    );
  }
);
