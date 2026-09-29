/** App shell steps: opening the app, the tabs, Settings. */

import { focusActor, onScreen, spawnActor, tabsVisible } from '@libs/harness';
import { type Actor, Then, When } from '@libs/harness/spec/define';
import { openSettingsAs } from '../harness/keyboard-actions';

/** `data-screen` ids of the shell's destinations. */
const SETTINGS = 'more';
const SPACES = 'spaces';

When('{actor} opens the app', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});

Then('{actor} sees the tabs', async (w, actor: Actor) => {
  await w.s.until((harness) => tabsVisible(harness, actor));
});

// By pointer, or by the keyboard alone when the person is said to use it.
When('{actor} opens Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettingsAs, actor);
});

Then('{actor} is (still )on Settings', async (w, actor: Actor) => {
  // Look at the person's own device; bringing it into view must not move them.
  await w.s.apply(focusActor, actor);
  await w.s.until((harness) => onScreen(harness, actor, SETTINGS));
});

Then('{actor} is (still )on Spaces', async (w, actor: Actor) => {
  // Look at the person's own device; bringing it into view must not move them.
  await w.s.apply(focusActor, actor);
  await w.s.until((harness) => onScreen(harness, actor, SPACES));
});
