/** Opening, reading, and setting aside a friend request in the inbox. */

import { expect } from 'bun:test';
import {
  archiveInboxItem,
  chooseInboxList,
  inboxItemState,
  markInboxRead,
  openInboxItem,
} from '@libs/friends-harness/inbox-items';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { rememberedUsername } from '@libs/profile-harness/remembered-username';

const SECOND_MS = 1_000;

When(
  '{actor} opens the friend request from {actor}',
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(openInboxItem, actor, rememberedUsername(w, from));
  }
);

When('{actor} marks the inbox read', async (w, actor: Actor) => {
  await w.s.apply(markInboxRead, actor);
});

When(
  '{actor} archives the friend request from {actor}',
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(archiveInboxItem, actor, rememberedUsername(w, from));
  }
);

Given(
  '{actor} has archived the friend request from {actor}',
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(archiveInboxItem, actor, rememberedUsername(w, from));
  }
);

When('{actor} looks at the waiting inbox', async (w, actor: Actor) => {
  await w.s.apply(chooseInboxList, actor, 'waiting');
});

Then(
  "{actor}'s inbox shows the friend request from {actor} as marked opened",
  async (w, actor: Actor, from: Actor) => {
    const username = rememberedUsername(w, from);
    await w.s.until((harness) => inboxItemState(harness, actor, username), {
      pred: (state) => state === 'opened',
      maxMs: 15 * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s inbox shows the friend request from {actor} as still waiting",
  async (w, actor: Actor, from: Actor) => {
    const username = rememberedUsername(w, from);
    await w.s.until((harness) => inboxItemState(harness, actor, username), {
      pred: (state) => state === 'waiting',
      maxMs: 15 * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s archived inbox shows the friend request from {actor}",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(chooseInboxList, actor, 'archived');
    const username = rememberedUsername(w, from);
    await w.s.until((harness) => inboxItemState(harness, actor, username), {
      pred: (state) => state !== null,
      maxMs: 15 * SECOND_MS,
    });
    expect(await w.s.read(inboxItemState, actor, username)).not.toBeNull();
  }
);
