/**
 * Using the app without seeing it (listening) or without a mouse (the
 * keyboard alone): what every control says, the avatar's description, where
 * the keyboard goes.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { onScreen, tabsVisible } from '@libs/harness-ts/ui-reads';
import {
  comeBackFromSettings,
  moveKeyboardThroughPage,
  openSettingsAs,
  openTabAs,
} from '../keyboard-actions';
import {
  keyboardIsOn,
  keyboardScreen,
  keyboardStopsShown,
  listenToApp,
  pageHeard,
  profilePictureHeard,
  useKeyboardAlone,
} from '../listener';
import { keyboardBeforeSettings, keyboardVisits } from '../people';

/** `data-screen` ids of the shell's destinations. */
const SETTINGS = 'more';
const NOTIFICATIONS = 'notifications';

Given('{actor} is listening to the app', async (w, actor: Actor) => {
  await w.s.apply(listenToApp, actor);
});

Given('{actor} is using the keyboard alone', async (w, actor: Actor) => {
  await w.s.apply(useKeyboardAlone, actor);
});

Then(
  '{actor} hears what every control on the tabs does',
  async (w, actor: Actor) => {
    await w.s.until((harness) => tabsVisible(harness, actor));
    const heard = await w.s.read(pageHeard, actor);
    expect(heard.controls).not.toEqual([]);
    expect(heard.problems).toEqual([]);
  }
);

Then(
  '{actor} hears what every control in Settings does',
  async (w, actor: Actor) => {
    // regression: offline-settings-menu-semantics
    await w.s.until((harness) => onScreen(harness, actor, SETTINGS));
    const heard = await w.s.read(pageHeard, actor);
    expect(heard.controls).not.toEqual([]);
    expect(heard.problems).toEqual([]);
  }
);

When('{actor} opens the Profile tab', async (w, actor: Actor) => {
  await w.s.apply(openTabAs, actor, 'profile');
});

When('{actor} opens the Notifications tab', async (w, actor: Actor) => {
  await w.s.apply(openTabAs, actor, 'notifications');
});

Then(
  '{actor} hears the picture on their profile described as their avatar',
  async (w, actor: Actor) => {
    const picture = await w.s.until(
      (harness) => profilePictureHeard(harness, actor),
      { pred: (heard) => heard !== null }
    );
    expect(picture?.role).toBe('img');
    expect(picture?.name.toLowerCase()).toContain('avatar');
  }
);

Then('{actor} is on Notifications', async (w, actor: Actor) => {
  // Look at the person's own device; bringing it into view must not move them.
  await w.s.apply(focusActor, actor);
  await w.s.until((harness) => onScreen(harness, actor, NOTIFICATIONS));
});

When('{actor} moves the keyboard through the tabs', async (w, actor: Actor) => {
  await w.s.apply(moveKeyboardThroughPage, actor);
});

Then(
  "{actor}'s keyboard reaches every control on the tabs once, in the order they are shown",
  async (w, actor: Actor) => {
    const shown = await w.s.read(keyboardStopsShown, actor);
    expect(shown).not.toEqual([]);
    expect(await w.s.read(keyboardVisits, actor)).toEqual(shown);
  }
);

Then("{actor}'s keyboard is in Settings", async (w, actor: Actor) => {
  await w.s.until((harness) => keyboardScreen(harness, actor), {
    pred: (screen) => screen === SETTINGS,
  });
});

Given('{actor} has opened Settings from Spaces', async (w, actor: Actor) => {
  await w.s.apply(openTabAs, actor, 'spaces');
  await w.s.apply(openSettingsAs, actor);
});

When('{actor} comes back from Settings', async (w, actor: Actor) => {
  await w.s.apply(comeBackFromSettings, actor);
});

Then(
  "{actor}'s keyboard is back where it was before {actor} opened Settings",
  async (w, actor: Actor, opener: Actor) => {
    const before = await w.s.read(keyboardBeforeSettings, opener);
    expect(before).not.toBeNull();
    await w.s.until((harness) => keyboardIsOn(harness, actor), {
      pred: (place) => place === before,
    });
  }
);
