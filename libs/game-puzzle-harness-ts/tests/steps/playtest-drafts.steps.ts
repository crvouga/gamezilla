import { expect } from 'bun:test';
import { playtestContentDraft } from '@libs/game-puzzle-harness-ts/attempt-actions';
import { finishContentAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import {
  currentAttemptView,
  ordinaryCompletionTitles,
} from '@libs/game-puzzle-harness-ts/attempt-observations';
import { arrangeContentDraft } from '@libs/game-puzzle-harness-ts/content-actions';
import { completionRecordCount } from '@libs/game-puzzle-harness-ts/offline-observations';
import { Given, Then, When } from './world';

Given(
  'Alice is playtesting her valid puzzle draft {string}',
  async (w, title: string) => {
    await w.run.apply(arrangeContentDraft, 'alice:phone', {
      title,
      valid: true,
    });
    await w.run.apply(playtestContentDraft, 'alice:phone');
  }
);

When('Alice completes that playtest', async (w) => {
  await w.run.apply(finishContentAttempt, 'alice:phone');
});

When('Alice playtests her puzzle draft', async (w) => {
  await w.run.apply(playtestContentDraft, 'alice:phone');
});

When(
  "Bob playtests Alice's puzzle draft {string}",
  async (w, _title: string) => {
    await w.run.apply(playtestContentDraft, 'bob:phone');
  }
);

Then('Alice sees that the playtest is complete', async (w) => {
  expect(await w.run.read(currentAttemptView, 'alice:phone')).toMatchObject({
    complete: true,
    mode: 'playtest',
  });
});

Then(
  'Alice has no ordinary completion for {string}',
  async (w, title: string) => {
    expect(
      await w.run.read(ordinaryCompletionTitles, 'alice:phone')
    ).not.toContain(title);
    expect(await w.run.read(completionRecordCount, 'alice:phone')).toBe(0);
  }
);

Then('Alice can play the private draft {string}', async (w, title: string) => {
  expect(await w.run.read(currentAttemptView, 'alice:phone')).toMatchObject({
    title,
    mode: 'playtest',
    complete: false,
  });
});
