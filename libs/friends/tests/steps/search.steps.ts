/**
 * People search steps. Search's own flows are specified here because the
 * `searchProfiles` query and the blocks filter it reads belong to friends.
 */

import { expect } from 'bun:test';

import { searchUntilAddOffered } from '@libs/friends/harness/friends-actions';
import { addFriendOffered } from '@libs/friends/harness/friends-ui-reads';
import { backToTabs } from '@libs/harness';
import { type Actor, Then, When } from '@libs/harness/spec/define';
import {
  searchUntilNobody,
  searchUsername,
} from '@libs/search/harness/search-actions';
import {
  searchNeedsConnection,
  searchResultVisible,
  searchShowsNobody,
} from '@libs/search/harness/search-ui-reads';

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
  expect(await w.s.read(searchShowsNobody, actor)).toBe(true);
});

// A search result is a snapshot: the observer searches again until the
// change reaches them (the harness action fails after the promised time).
Then(
  "{actor}'s search for {string} shows nobody within {int} seconds",
  async (w, actor: Actor, text: string, seconds: number) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(searchUntilNobody, actor, text, seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s search offers to ask {actor}",
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(addFriendOffered, actor, other)).toBe(true);
  }
);

Then(
  "{actor}'s search offers to ask {actor} again within {int} seconds",
  async (w, actor: Actor, other: Actor, seconds: number) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(searchUntilAddOffered, actor, other, seconds * SECOND_MS);
  }
);

Then(
  '{actor} is told search needs a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => searchNeedsConnection(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
