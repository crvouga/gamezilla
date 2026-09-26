/**
 * People search steps. Search's own flows are specified here because the
 * `searchProfiles` query and the blocks filter it reads belong to friends.
 */

import { expect } from 'bun:test';

import {
  addFriendOffered,
  handleVisible,
} from '@libs/friends/sim/friends-ui-reads';
import { searchUsername } from '@libs/search/sim/search-actions';
import { searchResultVisible } from '@libs/search/sim/search-ui-reads';
import { backToTabs } from '@libs/sim-harness';
import { type Actor, Then, When } from '@libs/sim-harness/spec/define';
import { Handles } from '@libs/test-ids';

const SECOND_MS = 1_000;

When('{actor} searches for {string}', async (w, actor: Actor, text: string) => {
  await w.s.apply(backToTabs, actor);
  await w.s.apply(searchUsername, actor, text);
});

Then(
  "{actor}'s search shows {person}",
  async (w, actor: Actor, person: string) => {
    expect(await w.s.read(searchResultVisible, actor, person)).toBe(true);
  }
);

Then(
  "{actor}'s search does not show {person}",
  async (w, actor: Actor, person: string) => {
    expect(await w.s.read(searchResultVisible, actor, person)).toBe(false);
  }
);

Then("{actor}'s search shows nobody", async (w, actor: Actor) => {
  expect(await w.s.read(handleVisible, actor, Handles.searchEmpty)).toBe(true);
});

Then(
  "{actor}'s search for {string} shows nobody within {int} seconds",
  async (w, actor: Actor, text: string, seconds: number) => {
    await w.s.apply(backToTabs, actor);
    await w.s.until(
      async (surf) => {
        await Promise.resolve(searchUsername.act(surf, actor, text));
        return handleVisible(surf, actor, Handles.searchEmpty);
      },
      { maxMs: seconds * SECOND_MS }
    );
  }
);

Then(
  "{actor}'s search offers to add {actor}",
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(addFriendOffered, actor, other)).toBe(true);
  }
);

Then(
  "{actor}'s search offers to add {actor} again within {int} seconds",
  async (w, actor: Actor, other: Actor, seconds: number) => {
    await w.s.apply(backToTabs, actor);
    await w.s.until(
      async (surf) => {
        await Promise.resolve(searchUsername.act(surf, actor, other));
        return addFriendOffered(surf, actor, other);
      },
      { maxMs: seconds * SECOND_MS }
    );
  }
);
