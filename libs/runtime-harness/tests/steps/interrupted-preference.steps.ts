/** An unfinished preference and a stretch of trouble keep what was saved. */

import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  openThemeChoices,
  runIntoTrouble,
} from '@libs/runtime-harness/preference-recovery';

Given(
  '{actor} has opened the theme choices without choosing',
  async (w, actor: Actor) => {
    await w.s.apply(openThemeChoices, actor);
  }
);

When('{actor} runs into trouble', async (w, actor: Actor) => {
  await w.s.apply(runIntoTrouble, actor);
});
