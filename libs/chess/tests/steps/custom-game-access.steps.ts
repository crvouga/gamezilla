import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing/harness/billing-actions';
import { membershipShown } from '@libs/billing/harness/billing-reads';
import { openCustomGame } from '@libs/chess/harness/custom-game-actions';
import {
  attemptCustomGameBoundary,
  readCustomGameBoundary,
} from '@libs/chess/harness/custom-game-boundary';
import { readCustomGameIdentity } from '@libs/chess/harness/custom-game-identity';
import { readCustomGameProbe } from '@libs/chess/harness/custom-game-ui';
import { focusActor } from '@libs/harness';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import { signInWithGoogle } from '@libs/harness/system/auth-actions';
import { openSpaceLink } from '@libs/spaces/harness/space-actions';
import { customPeople, customScreen, customSpace } from './custom-game-world';

Given("{actor} is outside {actor}'s space", async (w, actor: string) => {
  await w.s.apply(focusActor, actor);
  customPeople(w).set(actor, await w.s.read(readCustomGameIdentity, actor));
  expect(await w.s.read(readCustomGameProbe, actor)).toBeNull();
});
Given(
  "{actor} is a guest in {actor}'s space",
  async (w, actor: string, host: string) => customSpace(w, host, [actor])
);
Given(
  "{actor} has joined {actor}'s space from the link",
  async (w, actor: string, host: string) => customSpace(w, host, [actor])
);
Given(
  "{actor} is a Plus member in {actor}'s space",
  async (w, actor: Actor, host: string) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await customSpace(w, host, [actor]);
  }
);
Given("{actor}'s paid access has ended", async (w, actor: Actor) => {
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
  await w.s.apply(observeMembership, actor, 'cancel_now');
  await w.s.until(
    async () => (await w.s.read(membershipShown, actor))?.state === 'ended',
    { maxMs: 20_000 }
  );
  await customScreen(w, actor);
});
When('{actor} watches the Custom Game', async (w, actor: string) =>
  w.s.apply(openCustomGame, actor)
);
When('{actor} tries to watch the Custom Game', async (w, actor: string) => {
  await w.s.apply(openSpaceLink, actor, String(w.memo.get('custom-link')));
  await w.s.apply(attemptCustomGameBoundary, actor, {
    spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
  });
});
Then('{actor} cannot see the Custom Game', async (w, actor: string) => {
  expect(await w.s.read(readCustomGameProbe, actor)).toBeNull();
  const reply = await w.s.read(readCustomGameBoundary, actor);
  if (reply !== null) {
    expect(reply.reason).toBe('not in the space');
    expect(reply.disclosed).toBe(false);
  }
});
