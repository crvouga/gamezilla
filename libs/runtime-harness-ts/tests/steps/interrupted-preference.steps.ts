/** An unfinished preference and a stretch of trouble keep what was saved. */

import { Given, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  openSoundSettings,
  runIntoTrouble,
} from '@libs/runtime-harness-ts/preference-recovery';

Given(
  '{actor} has opened Sound without changing it',
  async (w, actor: Actor) => {
    await w.s.apply(openSoundSettings, actor);
  }
);

When('{actor} runs into trouble', async (w, actor: Actor) => {
  await w.s.apply(runIntoTrouble, actor);
});
