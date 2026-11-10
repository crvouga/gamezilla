import { expect } from 'bun:test';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { backToTabs, openAccount } from '@libs/harness-ts/shell-actions';
import { grantOperatorPermissions } from '@libs/observatory-actions-harness-ts/operator-access-actions';
import {
  emailOf,
  openPersonApp,
  watchEndedShown,
  watchedPlace,
  watchedScreen,
  watchLive,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import { syntheticGameView } from '@libs/synthetic-population-harness-ts/synthetic-game-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
/** How long a screen that was just opened may take to show what is already so. */
const SHOWN_MS = 10_000;
/** Watcher, Synthetic User, game, whose eyes, and how many seconds. */
type WatchedGame = [Actor, string, string, string, number];
const SEARCHED = 'observatory:searched-for';
const WATCH_PERMISSIONS = [
  PERMISSION.observatoryView,
  PERMISSION.observatoryWatch,
] as const;

Given(
  '{actor} is watching {actor} live',
  async (w, watcher: Actor, target: Actor) => {
    await w.s.apply(signInWithGoogle, watcher);
    await w.s.apply(grantOperatorPermissions, watcher, WATCH_PERMISSIONS);
    await w.s.apply(openPersonApp, target);
    await w.s.apply(watchLive, watcher, target);
  }
);
Given(
  '{actor} is watching the Synthetic User {string} live',
  async (w, watcher: Actor, name: string) => {
    await w.s.apply(signInWithGoogle, watcher);
    await w.s.apply(grantOperatorPermissions, watcher, WATCH_PERMISSIONS);
    await w.s.apply(givenSyntheticUser, name, false);
    await w.s.apply(watchLive, watcher, name);
  }
);

When('{actor} looks at his sign-in methods', async (w, actor: Actor) => {
  await w.s.apply(openAccount, actor);
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
  "{actor} sees {actor}'s place in the app is his sign-in methods within {int} seconds",
  async (w, watcher: Actor, _person: Actor, seconds: number) => {
    await w.s.until((s) => watchedPlace(s, watcher), {
      pred: (place) => place?.includes('Sign-in methods') === true,
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
  "{actor} cannot see the email address of {actor}'s Google sign-in method",
  async (w, watcher: Actor, person: Actor) => {
    const screen = await w.s.until((s) => watchedScreen(s, watcher), {
      pred: (html) => html?.includes('Sign-in methods') === true,
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
