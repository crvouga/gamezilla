/** Settings that stick: the appearance, sounds, and which version this is. */

import { expect } from 'bun:test';
import { partition } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor, openSettings } from '@libs/harness/shell-actions';
import {
  APP_VERSION_INSTALLED,
  appearanceShown,
  chooseTheme,
  connectionStateShown,
  openAbout,
  openConnectionInSettings,
  setWorkOfflineInCommandPalette,
  setWorkOfflineInSettings,
  signInFailureShown,
  soundShownInSettings,
  turnSoundsOff,
  versionShownInAbout,
  withoutConnectionShown,
  workOfflineShownInSettings,
} from '@libs/runtime-harness/app-settings';

Given('{actor} has chosen to work offline', async (w, actor: Actor) => {
  await w.s.apply(setWorkOfflineInSettings, actor, true);
});

Given(
  '{actor} is a guest who has chosen to work offline while their device has a connection',
  async (w, actor: Actor) => {
    await w.s.apply(setWorkOfflineInSettings, actor, true);
  }
);

Given(
  '{actor} has chosen to work offline while their device had no connection',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(partition, actor);
    await w.s.apply(setWorkOfflineInSettings, actor, true);
  }
);

When('{actor} chooses to work offline in Settings', async (w, actor: Actor) => {
  await w.s.apply(setWorkOfflineInSettings, actor, true);
});

When(
  '{actor} chooses to work offline in the command palette',
  async (w, actor: Actor) => {
    await w.s.apply(setWorkOfflineInCommandPalette, actor, true);
  }
);

When('{actor} stops working offline in Settings', async (w, actor: Actor) => {
  await w.s.apply(setWorkOfflineInSettings, actor, false);
});

When(
  '{actor} stops working offline in the command palette',
  async (w, actor: Actor) => {
    await w.s.apply(setWorkOfflineInCommandPalette, actor, false);
  }
);

Then(
  '{actor} is (still )shown they are working offline',
  async (w, actor: Actor) => {
    await w.s.until((harness) => workOfflineShownInSettings(harness, actor), {
      pred: (shown) => shown?.includes('Offline') === true,
    });
  }
);

Then('{actor} is shown they are online', async (w, actor: Actor) => {
  await w.s.until((harness) => workOfflineShownInSettings(harness, actor), {
    pred: (shown) => shown?.includes('Online') === true,
  });
});

Then(
  '{actor} is told signing in needs a connection',
  async (w, actor: Actor) => {
    await w.s.until((harness) => signInFailureShown(harness, actor), {
      pred: (shown) => shown?.toLowerCase().includes('work online') === true,
    });
  }
);

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

When('{actor} opens Connection in Settings', async (w, actor: Actor) => {
  await w.s.apply(openConnectionInSettings, actor);
});

Then(
  'Connection in Settings shows {actor} the app is connected',
  async (w, actor: Actor) => {
    await w.s.until((harness) => connectionStateShown(harness, actor), {
      pred: (state) => state === 'connected',
    });
  }
);

Then(
  'Connection in Settings shows {actor} the connection is missing',
  async (w, actor: Actor) => {
    await w.s.until((harness) => connectionStateShown(harness, actor), {
      pred: (state) => state === 'missing',
    });
  }
);

Then(
  'Connection in Settings shows {actor} what still works without a connection',
  async (w, actor: Actor) => {
    await w.s.until((harness) => withoutConnectionShown(harness, actor), {
      pred: (shown) => shown?.includes('on this device') === true,
    });
  }
);
