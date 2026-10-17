/**
 * What a space plays belongs to the space: the host picks chess and everyone
 * in it is taken there. Hosted here because chess is the game composed.
 */

import { expect } from 'bun:test';
import { selectChessGame } from '@libs/chess-matchmaking-harness/chess-game-choice';
import { chessGameMenuVisible } from '@libs/chess-root-harness/chess-ui-reads';
import {
  attemptLeaveChessMenu,
  attemptSelectChessGame,
  gameChoiceShown,
  hostChoosesShown,
} from '@libs/chess-root-harness/space-follow-actions';
import { partition } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import { signedInAccountOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { SECOND_MS } from './puzzle-world';

async function takenToChess(
  w: HarnessWorld,
  actor: string,
  seconds: number
): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => chessGameMenuVisible(surf, actor), {
    maxMs: seconds * SECOND_MS,
  });
}

const FOLLOW_MS = 15 * SECOND_MS;

async function onChess(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => chessGameMenuVisible(surf, actor), {
    maxMs: FOLLOW_MS,
  });
}

async function seesGameChoice(w: HarnessWorld, actor: string): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => gameChoiceShown(surf, actor), {
    maxMs: FOLLOW_MS,
  });
}

async function spaceLinkOf(w: HarnessWorld, host: Actor): Promise<string> {
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no space link`);
  return link;
}

async function ensureSignedIn(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(signedInAccountOf, actor)) !== null) return;
  const link = await w.s.read(readSpaceLink, actor);
  await w.s.apply(signInWithGoogle, actor);
  if (link !== null && !(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(joinViaLink, actor, link);
  }
}

async function placeOtherDevice(w: HarnessWorld, actor: Actor): Promise<void> {
  await ensureSignedIn(w, actor);
  const device = otherDevice(actor);
  const account = await w.s.read(signedInAccountOf, actor);
  const otherAccount = await w.s.read(signedInAccountOf, device);
  if (account === null || account !== otherAccount) {
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
  }
  await w.s.apply(joinViaLink, device, await spaceLinkOf(w, actor));
}

async function hostWithGuest(
  w: HarnessWorld,
  host: Actor,
  guest: Actor
): Promise<void> {
  await w.s.apply(signInWithGoogle, host);
  await w.s.apply(focusActor, host);
  await w.s.apply(createSpace, host);
  await w.s.apply(joinViaLink, guest, await spaceLinkOf(w, host));
}

When('{actor} picks chess for the space', async (w, host: Actor) => {
  await w.s.apply(focusActor, host);
  await w.s.apply(attemptSelectChessGame, host);
});

When(
  '{actor} picks chess for the space on her phone',
  async (w, host: Actor) => {
    await w.s.apply(focusActor, host);
    await w.s.apply(attemptSelectChessGame, host);
  }
);

When(
  '{actor} picks chess for the space on her other device',
  async (w, host: Actor) => {
    const device = otherDevice(host);
    await w.s.apply(focusActor, device);
    await w.s.apply(selectChessGame, device);
  }
);

Then(
  '{actor} is taken to chess within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await takenToChess(w, actor, seconds);
  }
);

Then(
  "{actor}'s phone is taken to chess within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await takenToChess(w, actor, seconds);
  }
);

Then(
  "{actor}'s phone and her other device are taken to chess within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await takenToChess(w, actor, seconds);
    await takenToChess(w, otherDevice(actor), seconds);
  }
);

Then(
  '{actor} is told only the host chooses the game',
  async (w, actor: Actor) => {
    expect(await w.s.read(hostChoosesShown, actor)).toBe(true);
  }
);

Then(
  '{actor} is not offered to pick chess for the space',
  async (w, actor: Actor) => {
    expect(await w.s.read(gameChoiceShown, actor)).toBe(false);
  }
);

Then(
  '{actor} is not offered to go back to the game choice',
  async (w, actor: Actor) => {
    expect(await w.s.read(chessGameMenuVisible, actor)).toBe(false);
  }
);

Then(
  "{actor}'s phone and her other device see the space's game choice",
  async (w, actor: Actor) => {
    await seesGameChoice(w, actor);
    await seesGameChoice(w, otherDevice(actor));
  }
);

When(
  '{actor} goes back from the chess choices to the game choice on her phone',
  async (w, actor: Actor) => {
    await w.s.apply(attemptLeaveChessMenu, actor);
  }
);

Given('{actor} has picked chess for the space', async (w, host: Actor) => {
  await w.s.apply(focusActor, host);
  await w.s.apply(selectChessGame, host);
});

Given(
  '{actor} has picked chess for the space from her other device',
  async (w, host: Actor) => {
    await placeOtherDevice(w, host);
    const device = otherDevice(host);
    await w.s.apply(focusActor, device);
    await w.s.apply(selectChessGame, device);
    await onChess(w, host);
    await onChess(w, 'bob');
  }
);

Given(
  "{actor}'s other device has picked chess for the space {actor} joined",
  async (w, host: Actor, guest: Actor) => {
    await hostWithGuest(w, host, guest);
    await placeOtherDevice(w, host);
    const device = otherDevice(host);
    await w.s.apply(focusActor, device);
    await w.s.apply(selectChessGame, device);
  }
);

Given(
  '{actor} has picked chess for the space {actor} joined and her phone is offline',
  async (w, host: Actor, guest: Actor) => {
    await hostWithGuest(w, host, guest);
    await w.s.apply(focusActor, host);
    await w.s.apply(selectChessGame, host);
    await onChess(w, guest);
    await w.s.apply(partition, host);
    await w.s.advanceTime(1_000);
  }
);
