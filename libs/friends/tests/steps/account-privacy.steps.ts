import { expect } from 'bun:test';
import {
  confirmDeletion,
  proveAccount,
} from '@libs/account-privacy/harness/privacy-actions';
import { requestDeletionReason } from '@libs/friends/harness/privacy-actions';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import { recall, remember, signedInAccountKey } from '@libs/harness/spec/world';
import {
  closeSpaceMembers,
  createSpace,
  openSpaceLink,
  openSpaceMembers,
} from '@libs/spaces/harness/space-actions';
import {
  activeSpaceVisible,
  joinOffered,
  readSpaceLink,
  readSpacePresenceCount,
  spaceEndedShown,
} from '@libs/spaces/harness/spaces-ui-reads';

Then(
  '{actor} cannot open the deleted profile because the account was deleted',
  async (w, _actor: Actor) => {
    await w.s.apply(
      openDeletedProfile,
      _actor,
      String(recall(w, signedInAccountKey('alice')))
    );
    expect(await w.s.read(deletedProfileNotice, _actor)).toContain(
      'account was deleted'
    );
  }
);
Then(
  '{actor} is told the request is no longer available because the account was deleted',
  async (w, actor: Actor) => {
    await w.s.until((s) => requestDeletionReason(s, actor, 'alice'), {
      maxMs: 15_000,
      pred: (text) => text?.includes('account was deleted') === true,
    });
  }
);
Given(
  "{actor}'s account deletion has ended {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    await w.s.apply(proveAccount, actor);
    await w.s.apply(createSpace, host);
    remember(w, 'spaceLink', await w.s.read(readSpaceLink, host));
    await w.s.apply(confirmDeletion, actor);
  }
);
When("{actor} opens {actor}'s space link", async (w, actor: Actor) => {
  await w.s.apply(openSpaceLink, actor, String(recall(w, 'spaceLink')));
});
Then(
  '{actor} cannot join because the space has ended',
  async (w, actor: Actor) => {
    await w.s.until((s) => spaceEndedShown(s, actor), { maxMs: 15_000 });
    expect(await w.s.read(joinOffered, actor)).toBe(false);
  }
);
Then(
  '{actor} sees only {actor} in the space within {int} seconds',
  async (w, observer: Actor, _remaining: Actor, seconds: number) => {
    await w.s.apply(openSpaceMembers, observer);
    await w.s.until((s) => readSpacePresenceCount(s, observer), {
      maxMs: seconds * 1_000,
      pred: (count) => count === 1,
    });
    await w.s.apply(closeSpaceMembers, observer);
  }
);
Then("{actor}'s space has not ended", async (w, actor: Actor) => {
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
  expect(await w.s.read(spaceEndedShown, actor)).toBe(false);
});

import {
  deletedDeviceReply,
  deletedProfileNotice,
  openDeletedProfile,
  tryDeletedDeviceJoin,
} from '@libs/friends/harness/deleted-device';

When(
  "{actor}'s other device attempts to join {actor}'s open space as the deleted account",
  async (w, actor: Actor, _host: Actor) => {
    await w.s.apply(tryDeletedDeviceJoin, actor);
  }
);
Then(
  '{actor} is told to sign in again because the account was deleted',
  async (w, _actor: Actor) => {
    const reply = await w.s.read(deletedDeviceReply);
    expect(reply?.status).toBe(401);
    expect<unknown>(reply?.body).toEqual({
      error: 'auth',
      reason: 'revoked',
      message: 'Sign in again because this account was deleted.',
    });
  }
);
