import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { openSettings } from '@libs/harness/shell-actions';

Given('{actor} has opened Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});
