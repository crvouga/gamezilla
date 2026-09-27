/**
 * The app as a person installs and opens it: opening it again without a
 * connection, addresses it does not have, and an install too old for the
 * product.
 */

import {
  followNotFoundWayBack,
  leaveAppOutdated,
  notFoundShown,
  notFoundWayBackOffered,
  openAddress,
  updateApp,
  updateRequested,
} from '@libs/runtime/sim/app-lifecycle';
import { onScreen, spawnActor } from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import { cutConnection } from '@libs/sim-harness/spec/steps/platform';

const SECOND_MS = 1_000;
/** An address no screen of the app answers. */
const UNKNOWN_ADDRESS = '/no-such-place';
/** `data-screen` id of Spaces. */
const SPACES = 'spaces';

Given('{actor} has opened the app before', async (w, actor: Actor) => {
  await w.s.apply(spawnActor, actor);
});

When(
  '{actor} opens an address the app does not have',
  async (w, actor: Actor) => {
    await w.s.apply(openAddress, actor, UNKNOWN_ADDRESS);
  }
);

Then(
  '{actor} is told there is nothing at that address',
  async (w, actor: Actor) => {
    await w.s.until((sim) => notFoundShown(sim, actor));
  }
);

Then('{actor} can go back to Spaces', async (w, actor: Actor) => {
  await w.s.until((sim) => notFoundWayBackOffered(sim, actor));
  // The way back is only proven by taking it.
  await w.s.apply(followNotFoundWayBack, actor);
  await w.s.until((sim) => onScreen(sim, actor, SPACES));
});

Given(
  "{actor}'s app is older than the product accepts",
  async (w, actor: Actor) => {
    // Away from the product while it moved on: the app has not heard yet.
    await w.s.apply(spawnActor, actor);
    await cutConnection(w, actor);
    await w.s.apply(leaveAppOutdated, actor);
  }
);

When('{actor} updates the app', async (w, actor: Actor) => {
  await w.s.apply(updateApp, actor);
});

Then(
  '{actor} is asked to update the app within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((sim) => updateRequested(sim, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
