/**
 * `specs/games/space-follows-the-host.feature`: the host picks the run's
 * game for the space and every device in it follows; a guest or an offline
 * device cannot choose it or leave it.
 */

import { expect } from 'bun:test';
import { putOtherDeviceInSpace } from '@libs/friends-harness-ts/space-idle.steps';
import { rememberedSpaceGuests } from '@libs/friends-harness-ts/spaces.steps';
import { pickGame } from '@libs/game-session-harness-ts/game-navigation';
import {
  attemptGoBackToGameChoice,
  attemptPickGame,
  goBackToGameChoiceOffered,
  hostChoosesGameShown,
  pickGameOffered,
  readSpaceView,
  type SpaceView,
} from '@libs/game-session-harness-ts/space-game-choice';
import { partition } from '@libs/harness-ts/actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { gameOf } from './game-world';

const SECOND_MS = 1000;
/** How long the space takes to follow its host (the feature's 15 seconds). */
const FOLLOW_MS = 15 * SECOND_MS;

async function untilView(
  w: HarnessWorld,
  actor: string,
  view: SpaceView,
  maxMs: number
): Promise<void> {
  await w.s.apply(focusActor, actor);
  expect(
    await w.s.until((s) => readSpaceView(s, actor, gameOf(w).shared.id), {
      maxMs,
      pred: (shown) => shown === view,
    })
  ).toBe(view);
}

/** `host` and `guest` are in a space `host` created signed in. */
async function hostWithGuest(
  w: HarnessWorld,
  host: Actor,
  guest: Actor
): Promise<void> {
  await w.s.apply(signInWithGoogle, host);
  await w.s.apply(focusActor, host);
  await w.s.apply(createSpace, host);
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no space link`);
  await w.s.apply(joinViaLink, guest, link);
}

/** `device` picks the game, which the space shows to `followers`. */
async function picked(
  w: HarnessWorld,
  device: string,
  followers: readonly string[]
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.apply(pickGame, device, gameOf(w).shared.id);
  for (const actor of followers) await untilView(w, actor, 'game', FOLLOW_MS);
}

When('{actor} picks the game for the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(attemptPickGame, actor, gameOf(w).shared.id);
});
When(
  '{actor} picks the game for the space on her phone',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(attemptPickGame, actor, gameOf(w).shared.id);
  }
);
When(
  '{actor} picks the game for the space on her other device',
  async (w, actor: Actor) => {
    const device = otherDevice(actor);
    await w.s.apply(focusActor, device);
    await w.s.apply(attemptPickGame, device, gameOf(w).shared.id);
  }
);
When(
  "{actor} goes back from the game's choices to the game choice",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(attemptGoBackToGameChoice, actor, gameOf(w).shared.id);
  }
);
When(
  "{actor} goes back from the game's choices to the game choice on her phone",
  async (w, actor: Actor) => {
    await w.s.apply(attemptGoBackToGameChoice, actor, gameOf(w).shared.id);
  }
);

Given('{actor} has picked the game for the space', async (w, host: Actor) =>
  picked(w, host, [host, ...rememberedSpaceGuests(w)])
);
Given(
  '{actor} has picked the game for the space from her other device',
  async (w, host: Actor) => {
    await putOtherDeviceInSpace(w, host);
    await picked(w, otherDevice(host), [host, ...rememberedSpaceGuests(w)]);
  }
);
Given(
  "{actor}'s other device has picked the game for the space {actor} joined",
  async (w, host: Actor, guest: Actor) => {
    await hostWithGuest(w, host, guest);
    await putOtherDeviceInSpace(w, host);
    await picked(w, otherDevice(host), []);
  }
);
Given(
  '{actor} has picked the game for the space {actor} joined and her phone is offline',
  async (w, host: Actor, guest: Actor) => {
    await hostWithGuest(w, host, guest);
    await picked(w, host, [guest]);
    await w.s.apply(partition, host);
    await w.s.advanceTime(SECOND_MS);
  }
);

Then(
  "{actor}'s phone is shown the game's choices within {int} seconds",
  async (w, actor: Actor, seconds: number) =>
    untilView(w, actor, 'game', seconds * SECOND_MS)
);
Then(
  "{actor}'s phone and her other device are shown the game's choices within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilView(w, actor, 'game', seconds * SECOND_MS);
    await untilView(w, otherDevice(actor), 'game', seconds * SECOND_MS);
  }
);
Then("{actor} sees the space's game choice", async (w, actor: Actor) =>
  untilView(w, actor, 'choice', FOLLOW_MS)
);
Then(
  "{actor}'s phone and her other device see the space's game choice",
  async (w, actor: Actor) => {
    await untilView(w, actor, 'choice', FOLLOW_MS);
    await untilView(w, otherDevice(actor), 'choice', FOLLOW_MS);
  }
);
Then(
  '{actor} is told only the host chooses the game',
  async (w, actor: Actor) => {
    expect(await w.s.read(hostChoosesGameShown, actor)).toBe(true);
  }
);
Then(
  '{actor} is not offered to pick the game for the space',
  async (w, actor: Actor) => {
    expect(await w.s.read(pickGameOffered, actor, gameOf(w).shared.id)).toBe(
      false
    );
  }
);
Then(
  '{actor} is not offered to go back to the game choice',
  async (w, actor: Actor) => {
    expect(await w.s.read(goBackToGameChoiceOffered, actor)).toBe(false);
  }
);
