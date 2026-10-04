/** Settings that stick: the appearance, sounds, and which version this is. */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { openSettings } from '@libs/harness/shell-actions';
import {
  APP_VERSION_INSTALLED,
  appearanceShown,
  chooseTheme,
  openAbout,
  soundShownInSettings,
  turnSoundsOff,
  versionShownInAbout,
} from '@libs/runtime-harness/app-settings';

Given('{actor} has chosen the dark theme', async (w, actor: Actor) => {
  await w.s.apply(chooseTheme, actor, 'dark');
});

Then("{actor}'s app is dark", async (w, actor: Actor) => {
  await w.s.until((harness) => appearanceShown(harness, actor), {
    pred: (scheme) => scheme === 'dark',
  });
});

Given('{actor} has turned sounds off', async (w, actor: Actor) => {
  await w.s.apply(turnSoundsOff, actor);
});

Then("{actor}'s sounds are off", async (w, actor: Actor) => {
  // Settings is where a person sees whether sounds are on.
  await w.s.apply(openSettings, actor);
  await w.s.until((harness) => soundShownInSettings(harness, actor), {
    pred: (shown) => shown !== null && shown.includes('Muted'),
  });
});

When('{actor} opens About in Settings', async (w, actor: Actor) => {
  await w.s.apply(openAbout, actor);
});

Then(
  '{actor} is shown the version of the app they have',
  async (w, actor: Actor) => {
    const shown = await w.s.read(versionShownInAbout, actor);
    expect(shown).toContain(APP_VERSION_INSTALLED);
  }
);
