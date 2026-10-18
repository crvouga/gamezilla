import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { membershipShown } from '@libs/billing-harness/billing-reads';
import {
  attemptCustomGameBoundary,
  readCustomGameBoundary,
} from '@libs/game-session-harness/custom-game-boundary';
import { joinCustomGamesAsGuest } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-probe';
import { readCustomGameRefusal } from '@libs/game-session-harness/custom-game-screen';
import { openCustomGames } from '@libs/game-session-harness/game-navigation';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { openSpaceLink } from '@libs/spaces-harness/space-actions';
import { inSpace, toldOf } from './custom-game-set-up-world';
import { backToCustomGames, gameOf, hostOf, spaceLinkOf } from './game-world';

/** How long a membership change may take to reach the person's billing. */
const MEMBERSHIP_MS = 20_000;

/** `actor` opens the space link and asks for its custom game as a device could. */
export async function tryToWatch(
  w: HarnessWorld,
  actor: string,
  link: string
): Promise<void> {
  await w.s.apply(openSpaceLink, actor, link);
  await w.s.apply(attemptCustomGameBoundary, actor, {
    spaceId: link.split('/space/')[1] ?? '',
  });
}

/** `actor` sees no custom game, and is shown nothing of it when asking. */
export async function seesNoCustomGame(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  expect(await w.s.read(readCustomGameProbe, actor)).toBeNull();
  const reply = await w.s.read(readCustomGameBoundary, actor);
  if (reply !== null)
    expect(reply).toEqual({ reason: 'not in the space', disclosed: false });
}

Given("{actor} is a guest in {actor}'s space", async (w, person: string) => {
  await w.s.apply(
    joinCustomGamesAsGuest,
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
  await backToCustomGames(w, person);
});

When('{actor} watches the custom game', async (w, actor: string) => {
  await w.s.apply(openCustomGames, actor, gameOf(w).shared.id);
});
When('{actor} tries to watch the custom game', async (w, actor: string) =>
  tryToWatch(w, actor, await spaceLinkOf(w))
);

Then('{actor} cannot see the custom game', async (w, actor: string) =>
  seesNoCustomGame(w, actor)
);
Then('{actor} is told she is not in the space', async (w, actor: string) => {
  expect(await w.s.read(readCustomGameRefusal, actor)).toBe('not in the space');
});
Then(
  '{actor} is told only the creator sets up the custom game',
  async (w, actor: string) =>
    toldOf(
      w,
      actor,
      'only the creator configures the Custom Game',
      'only the creator'
    )
);
