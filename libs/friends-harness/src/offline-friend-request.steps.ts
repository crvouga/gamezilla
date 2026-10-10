import { expect } from 'bun:test';
import { partition } from '@libs/harness/actions';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  blockRevealed,
  requestUnavailableRefusal,
  requestWaitingToShare,
} from './friend-request-feedback-reads';
import { askOffered } from './friends-ui-reads';
import { openPersonFromSearch, sendRequestFromProfile } from './person-actions';

Given(
  "{actor} has sent {actor} a friend request while viewing {actor}'s profile offline",
  async (w, from: Actor, to: Actor, whose: Actor) => {
    if (to !== whose) throw new Error('The request must use the named profile');
    await w.s.apply(openPersonFromSearch, from, to);
    await w.s.apply(partition, from);
    await w.s.advanceTime(1_000);
    await w.s.apply(sendRequestFromProfile, from, to);
  }
);

Then(
  '{actor} is told their friend request will be shared when the connection returns',
  async (w, actor: Actor) => {
    await w.s.until((surf) => requestWaitingToShare(surf, actor));
  }
);

Then(
  '{actor} is no longer told their friend request is waiting to be shared',
  async (w, actor: Actor) => {
    await w.s.until((surf) => requestWaitingToShare(surf, actor), {
      pred: (pending) => !pending,
    });
  }
);

Then(
  '{actor} is not offered to send {actor} another friend request',
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(askOffered, actor, other)).toBe(false);
  }
);

Then(
  '{actor} is told their friend request could not be shared because the person is unavailable',
  async (w, actor: Actor) => {
    await w.s.until((surf) => requestUnavailableRefusal(surf, actor));
  }
);

Then(
  '{actor} is not told {actor} blocked them',
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(blockRevealed, actor, other)).toBe(false);
  }
);
