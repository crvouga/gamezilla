import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { recall, remember } from '@libs/harness/spec-world';
import {
  changeAvailableSpace,
  layoutControlsReachable,
  layoutPlaceAndPreferences,
  saveLayoutPreferences,
} from '@libs/runtime-harness/device-layout';

Given('{actor} is using the app on a phone', async (w, actor: Actor) => {
  await w.s.apply(changeAvailableSpace, actor, 390, 844);
});
Given('{actor} is using the app on a tablet', async (w, actor: Actor) => {
  await w.s.apply(changeAvailableSpace, actor, 1180, 820);
});
Given('{actor} is using the app on a computer', async (w, actor: Actor) => {
  await w.s.apply(changeAvailableSpace, actor, 1440, 900);
});
Given(
  '{actor} has a place in the app and saved preferences',
  async (w, actor: Actor) => {
    await w.s.apply(saveLayoutPreferences, actor);
    remember(
      w,
      'place-preferences',
      await w.s.read(layoutPlaceAndPreferences, actor)
    );
  }
);
When(
  '{actor} turns the phone from portrait to landscape',
  async (w, actor: Actor) => {
    await w.s.apply(changeAvailableSpace, actor, 844, 390);
  }
);
When(
  '{actor} turns the tablet from landscape to portrait',
  async (w, actor: Actor) => {
    await w.s.apply(changeAvailableSpace, actor, 820, 1180);
  }
);
When(
  '{actor} narrows the space available to the app',
  async (w, actor: Actor) => {
    await w.s.apply(changeAvailableSpace, actor, 360, 900);
  }
);
Then(
  '{actor} has the same place in the app and saved preferences',
  async (w, actor: Actor) => {
    expect<unknown>(await w.s.read(layoutPlaceAndPreferences, actor)).toEqual(
      recall(w, 'place-preferences')
    );
  }
);
Then(
  '{actor} can reach every control offered there',
  async (w, actor: Actor) => {
    expect(await w.s.read(layoutControlsReachable, actor)).toBe(true);
  }
);
