import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { openSettings } from '@libs/harness/shell-actions';
import { connectionMissing } from '@libs/runtime-harness/connection-continuity';

Given('{actor} has opened Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});

Then(
  '{actor} is told the connection is missing within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((s) => connectionMissing(s, actor), {
      maxMs: seconds * 1_000,
    });
  }
);
