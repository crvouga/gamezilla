import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { membershipShown } from '@libs/billing-harness-ts/billing-reads';
import { openGameSessions } from '@libs/game-session-harness-ts/game-navigation';
import {
  attemptGameSessionBoundary,
  readGameSessionBoundary,
} from '@libs/game-session-harness-ts/game-session-boundary';
import { joinGameSessionsAsGuest } from '@libs/game-session-harness-ts/game-session-lineup';
import { readGameSessionProbe } from '@libs/game-session-harness-ts/game-session-probe';
import { readGameSessionRefusal } from '@libs/game-session-harness-ts/game-session-screen';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { openSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { inSpace, toldOf } from './game-session-set-up-world';
import { backToGameSessions, gameOf, hostOf, spaceLinkOf } from './game-world';

/** How long a membership change may take to reach the person's billing. */
const MEMBERSHIP_MS = 20_000;

/** `actor` opens the space link and asks for its game session as a device could. */
export async function tryToWatch(
  w: HarnessWorld,
  actor: string,
  link: string
): Promise<void> {
  await w.s.apply(openSpaceLink, actor, link);
  await w.s.apply(attemptGameSessionBoundary, actor, {
    spaceId: link.split('/space/')[1] ?? '',
  });
}

/** `actor` sees no game session, and is shown nothing of it when asking. */
export async function seesNoGameSession(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  expect(await w.s.read(readGameSessionProbe, actor)).toBeNull();
  const reply = await w.s.read(readGameSessionBoundary, actor);
  if (reply !== null)
    expect(reply).toEqual({ reason: 'not in the space', disclosed: false });
}

Given("{actor} is a guest in {actor}'s space", async (w, person: string) => {
  await w.s.apply(
    joinGameSessionsAsGuest,
    gameOf(w).shared.id,
    hostOf(w),
    person
  );
});
Given(
  "{actor} is a Plus member in {actor}'s space",
  async (w, person: Actor) => {
    await w.s.apply(signInWithGoogle, person);
    await w.s.apply(openBilling, person);
    await w.s.apply(subscribeToPlus, person);
    await inSpace(w, person);
  }
);
Given("{actor}'s paid access has ended", async (w, person: Actor) => {
  await w.s.apply(openBilling, person);
  await w.s.apply(subscribeToPlus, person);
  await w.s.apply(observeMembership, person, 'cancel_now');
  await w.s.until((s) => membershipShown(s, person), {
    pred: (shown) => shown?.state === 'ended',
    maxMs: MEMBERSHIP_MS,
  });
  await backToGameSessions(w, person);
});

When('{actor} watches the game session', async (w, actor: string) => {
  await w.s.apply(openGameSessions, actor, gameOf(w).shared.id);
});
When('{actor} tries to watch the game session', async (w, actor: string) =>
  tryToWatch(w, actor, await spaceLinkOf(w))
);

Then('{actor} cannot see the game session', async (w, actor: string) =>
  seesNoGameSession(w, actor)
);
Then('{actor} is told she is not in the space', async (w, actor: string) => {
  expect(await w.s.read(readGameSessionRefusal, actor)).toBe(
    'not in the space'
  );
});
Then(
  '{actor} is told only the creator sets up the game session',
  async (w, actor: string) =>
    toldOf(
      w,
      actor,
      'only the creator configures the Game Session',
      'only the creator'
    )
);
