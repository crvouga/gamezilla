import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { openSettings } from '@libs/harness-ts/shell-actions';
import {
  closePersonApp,
  onlineNowRow,
  openPersonApp,
  showOnlyOnlineNow,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import { lookForOpponent } from '@libs/observatory-harness-ts/person-activity-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
/** How long a list that was just opened may take to show what is already so. */
const SHOWN_MS = 10_000;

Given(
  '{actor} and the Synthetic User {string} are using the app now',
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
