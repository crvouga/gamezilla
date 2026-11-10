import { expect } from 'bun:test';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { backToTabs, openSettings } from '@libs/harness-ts/shell-actions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import {
  closePersonApp,
  emailOf,
  lookForOpponent,
  onlineNowRow,
  openPersonApp,
  showOnlyOnlineNow,
  watchEndedShown,
  watchedPlace,
  watchedScreen,
  watchLive,
} from '@libs/synthetic-population-harness-ts/live-observatory-actions';
import {
  grantSyntheticPopulationAccess,
  openObservatory,
} from '@libs/synthetic-population-harness-ts/observatory-actions';
import { syntheticGameView } from '@libs/synthetic-population-harness-ts/synthetic-game-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
/** How long a list that was just opened may take to show what is already so. */
const SHOWN_MS = 10_000;
/** Watcher, Synthetic User, game, whose eyes, and how many seconds. */
type WatchedGame = [Actor, string, string, string, number];
const SEARCHED = 'synthetic-population:searched-for';
const WATCH_PERMISSIONS = [
  PERMISSION.syntheticPopulationView,
  PERMISSION.syntheticPopulationWatch,
] as const;

Given(
  '{actor} is authorized to watch someone live',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantSyntheticPopulationAccess, actor, WATCH_PERMISSIONS);
  }
);
// Observing is not watching: the Bot Observatory opens, watching live does not.
Given(
  '{actor} is not authorized to watch someone live',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantSyntheticPopulationAccess, actor, [
      PERMISSION.syntheticPopulationView,
    ]);
  }
);
Given('{actor} has opened the Bot Observatory', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(grantSyntheticPopulationAccess, actor, [
    PERMISSION.syntheticPopulationView,
  ]);
  await w.s.apply(openObservatory, actor);
});
Given('{actor} is online now', async (w, actor: Actor) => {
  await w.s.apply(openPersonApp, actor);
});
Given(
  '{actor} and the Synthetic User {string} are online now',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(givenSyntheticUser, name, false);
    await w.s.apply(openPersonApp, actor);
  }
);
Given(
  '{actor} is looking for a multiplayer opponent for {string}',
  async (w, actor: Actor, game: string) => {
    await w.s.apply(lookForOpponent, actor, game);
  }
);
Given(
  '{actor} is watching {actor} live',
  async (w, watcher: Actor, target: Actor) => {
    await w.s.apply(signInWithGoogle, watcher);
    await w.s.apply(grantSyntheticPopulationAccess, watcher, WATCH_PERMISSIONS);
    await w.s.apply(openPersonApp, target);
    await w.s.apply(watchLive, watcher, target);
  }
);
Given(
  '{actor} is watching the Synthetic User {string} live',
  async (w, watcher: Actor, name: string) => {
    await w.s.apply(signInWithGoogle, watcher);
    await w.s.apply(grantSyntheticPopulationAccess, watcher, WATCH_PERMISSIONS);
    await w.s.apply(givenSyntheticUser, name, false);
    await w.s.apply(watchLive, watcher, name);
  }
);

When('{actor} shows only people online now', async (w, actor: Actor) => {
  await w.s.apply(showOnlyOnlineNow, actor, 'people');
});
When(
  '{actor} shows only Synthetic Users online now',
  async (w, actor: Actor) => {
    await w.s.apply(showOnlyOnlineNow, actor, 'synthetic');
  }
);
When('{actor} opens the app', async (w, actor: Actor) => {
  await w.s.apply(openPersonApp, actor);
});
When('{actor} closes the app', async (w, actor: Actor) => {
  await w.s.apply(closePersonApp, actor);
});
When('{actor} opens Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});
When('{actor} searches for {string}', async (w, actor: Actor, text: string) => {
  w.memo.set(SEARCHED, text);
  await w.s.apply(backToTabs, actor);
  await w.s.apply(searchUsername, actor, text);
});
When(
  '{actor} watches {actor} live',
  async (w, watcher: Actor, target: Actor) => {
    await w.s.apply(watchLive, watcher, target);
  }
);
When(
  '{actor} watches {string} live',
  async (w, watcher: Actor, name: string) => {
    await w.s.apply(watchLive, watcher, name);
  }
);

Then(
  '{actor} sees {actor} online now as a person looking for a multiplayer opponent for {string}',
  async (w, observer: Actor, person: Actor, game: string) => {
    const row = await w.s.until((s) => onlineNowRow(s, observer, person), {
      pred: (text) =>
        text?.toLowerCase().includes(`opponent for ${game.toLowerCase()}`) ===
        true,
      maxMs: SHOWN_MS,
    });
    expect(row).toContain('Person');
  }
);
Then(
  '{actor} sees {string} online now as a Synthetic User playing {string}',
  async (w, observer: Actor, name: string, game: string) => {
    const row = await w.s.until((s) => onlineNowRow(s, observer, name), {
      pred: (text) =>
        text?.toLowerCase().includes(`playing ${game.toLowerCase()}`) === true,
      maxMs: SHOWN_MS,
    });
    expect(row).toContain('Synthetic User');
  }
);
Then(
  '{actor} sees {actor} online now',
  async (w, observer: Actor, person: Actor) => {
    await w.s.until((s) => onlineNowRow(s, observer, person), {
      pred: (text) => text !== null,
      maxMs: SHOWN_MS,
    });
  }
);
Then(
  '{actor} sees {string} online now',
  async (w, observer: Actor, name: string) => {
    await w.s.until((s) => onlineNowRow(s, observer, name), {
      pred: (text) => text !== null,
      maxMs: SHOWN_MS,
    });
  }
);
Then(
  '{actor} does not see {actor} online now',
  async (w, observer: Actor, person: Actor) => {
    expect(await w.s.read(onlineNowRow, observer, person)).toBeNull();
  }
);
Then(
  '{actor} does not see {string} online now',
  async (w, observer: Actor, name: string) => {
    expect(await w.s.read(onlineNowRow, observer, name)).toBeNull();
  }
);
Then(
  '{actor} sees {actor} online now within {int} seconds',
  async (w, observer: Actor, person: Actor, seconds: number) => {
    await w.s.until((s) => onlineNowRow(s, observer, person), {
      pred: (text) => text !== null,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  '{actor} does not see {actor} online now within {int} seconds',
  async (w, observer: Actor, person: Actor, seconds: number) => {
    await w.s.until((s) => onlineNowRow(s, observer, person), {
      pred: (text) => text === null,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  '{actor} does not see {string} online now within {int} minutes',
  async (w, observer: Actor, name: string, minutes: number) => {
    await w.s.until((s) => onlineNowRow(s, observer, name), {
      pred: (text) => text === null,
      maxMs: minutes * MINUTE_MS,
    });
  }
);
// Their place, and what is shown there: both, as they see them.
Then(
  "{actor} sees {actor}'s place in the app within {int} seconds",
  async (w, watcher: Actor, _person: Actor, seconds: number) => {
    await w.s.until((s) => watchedPlace(s, watcher), {
      pred: (place) => place !== null && place.length > 0,
      maxMs: seconds * SECOND_MS,
    });
    await w.s.until((s) => watchedScreen(s, watcher), {
      pred: (screen) => screen !== null,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  "{actor} sees {actor}'s place in the app is Settings within {int} seconds",
  async (w, watcher: Actor, _person: Actor, seconds: number) => {
    await w.s.until((s) => watchedPlace(s, watcher), {
      pred: (place) => place?.includes('Settings') === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  "{actor} sees {actor}'s place in the app is people search within {int} seconds",
  async (w, watcher: Actor, _person: Actor, seconds: number) => {
    await w.s.until((s) => watchedPlace(s, watcher), {
      pred: (place) => place?.includes('People search') === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  "{actor} sees {string}'s ongoing {string} game as {string} sees it within {int} seconds",
  async (w, ...[watcher, name, , , seconds]: WatchedGame) => {
    const own = await w.s.read(syntheticGameView, name.toLowerCase());
    expect(own.outcome).toBe('ongoing');
    await w.s.until((s) => watchedScreen(s, watcher), {
      pred: (screen) =>
        screen?.includes(`data-game-id="${own.gameId}"`) === true &&
        screen.includes(`data-fen="${own.position}"`),
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  "{actor} does not see {actor}'s place in the app",
  async (w, watcher: Actor, _person: Actor) => {
    expect(await w.s.read(watchedPlace, watcher)).toBeNull();
    expect(await w.s.read(watchedScreen, watcher)).toBeNull();
  }
);
Then(
  "{actor} cannot see {actor}'s email address",
  async (w, watcher: Actor, person: Actor) => {
    const screen = await w.s.until((s) => watchedScreen(s, watcher), {
      pred: (html) => html?.includes('Settings') === true,
      maxMs: SHOWN_MS,
    });
    expect(screen).not.toContain(await w.s.read(emailOf, person));
  }
);
Then(
  '{actor} cannot see what {actor} searched for',
  async (w, watcher: Actor, _person: Actor) => {
    const screen = await w.s.until((s) => watchedScreen(s, watcher), {
      pred: (html) => html?.includes('Find people') === true,
      maxMs: SHOWN_MS,
    });
    const searched = String(w.memo.get(SEARCHED)).toLowerCase();
    expect(screen?.toLowerCase()).not.toContain(searched);
  }
);
Then(
  '{actor} is told {actor} is no longer online now within {int} seconds',
  async (w, watcher: Actor, _person: Actor, seconds: number) => {
    await w.s.until((s) => watchEndedShown(s, watcher), {
      pred: Boolean,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  '{actor} is told {string} is no longer online now within {int} minutes',
  async (w, watcher: Actor, _name: string, minutes: number) => {
    await w.s.until((s) => watchEndedShown(s, watcher), {
      pred: Boolean,
      maxMs: minutes * MINUTE_MS,
    });
  }
);
