/**
 * The app as a person installs and opens it: opening it again without a
 * connection, addresses it does not have, and an install too old for the
 * product.
 */

import { spawnActor } from '@libs/harness/actions';
import type { Actor } from '@libs/harness/parameter-types';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { cutConnection } from '@libs/harness/platform';
import { followNotFoundWayBack, leaveAppOutdated, notFoundShown, notFoundWayBackOffered, openAddress, updateApp, updateRequested } from '@libs/runtime-harness/app-lifecycle';

const SECOND_MS = 1_000;
/** An address no screen of the app answers. */
const UNKNOWN_ADDRESS = '/no-such-place';

Given('{actor} has opened the app before', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});

When(
  '{actor} opens an address the app does not have',
  async (w, actor: Actor) => {
    await w.s.apply(openAddress, actor, UNKNOWN_ADDRESS);
  }
);

Given(
  '{actor} has opened an address the app does not have',
  async (w, actor: Actor) => {
    await w.s.apply(openAddress, actor, UNKNOWN_ADDRESS);
    // Precondition: the dead end is on screen before the scenario acts.
    await w.s.until((harness) => notFoundShown(harness, actor));
  }
);

Then(
  '{actor} is told there is nothing at that address',
  async (w, actor: Actor) => {
    await w.s.until((harness) => notFoundShown(harness, actor));
  }
);

Then('{actor} is offered the way back to Spaces', async (w, actor: Actor) => {
  await w.s.until((harness) => notFoundWayBackOffered(harness, actor));
});

When('{actor} takes the way back to Spaces', async (w, actor: Actor) => {
  await w.s.apply(followNotFoundWayBack, actor);
});

/** Away from the product while it moved on: the app has not heard yet. */
async function outdateWhileAway(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(spawnActor, actor);
  await cutConnection(w, actor);
  await w.s.apply(leaveAppOutdated, actor);
}

Given(
  "{actor}'s app became outdated while {actor} was offline",
  async (w, actor: Actor, _same: Actor) => {
    await outdateWhileAway(w, actor);
  }
);

Given(
  "{actor}'s app is older than the product accepts",
  async (w, actor: Actor) => {
    await outdateWhileAway(w, actor);
  }
);

When('{actor} updates the app', async (w, actor: Actor) => {
  await w.s.apply(updateApp, actor);
});

Then(
  '{actor} is asked to update the app within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((harness) => updateRequested(harness, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
