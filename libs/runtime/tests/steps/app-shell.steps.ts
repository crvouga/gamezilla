/** App shell steps: opening the app, the tabs, Settings, switching people. */

import { expect } from 'bun:test';

import {
  actorIds,
  focusActor,
  onScreen,
  openSettings,
  spawnActor,
  tabsVisible,
} from '@libs/sim-harness';
import { type Actor, Then, When } from '@libs/sim-harness/spec/define';

/** `data-screen` ids of the shell's destinations. */
const SETTINGS = 'more';
const SPACES = 'spaces';

When('{actor} opens the app', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});

Then('{actor} sees the tabs', async (w, actor: Actor) => {
  await w.s.until((sim) => tabsVisible(sim, actor));
});

Then(
  'only {actor} and {actor} are using the app',
  async (w, first: Actor, second: Actor) => {
    expect(await w.s.read(actorIds)).toEqual([first, second]);
  }
);

When('{actor} opens Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});

When("the view switches to {actor}'s device", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
});

Then('{actor} is on Settings', async (w, actor: Actor) => {
  await w.s.until((sim) => onScreen(sim, actor, SETTINGS));
});

Then('{actor} is on Spaces', async (w, actor: Actor) => {
  await w.s.until((sim) => onScreen(sim, actor, SPACES));
});

Then('{actor} is not on Settings', async (w, actor: Actor) => {
  expect(await w.s.read(onScreen, actor, SETTINGS)).toBe(false);
});
