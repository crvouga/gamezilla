/**
 * Steps for a space the app can't reach (`specs/spaces/space-unreachable`,
 * and the puzzle case in `specs/games/puzzle-attempt-resume`): the product
 * forgets a space while the host's device still holds it.
 */

import { expect } from 'bun:test';

import { restartApp } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  openSpacesTab,
  returnToLobby,
  returnToOwnSpace,
} from '@libs/spaces-harness/space-actions';
import {
  forgetSpace,
  tryReachingSpaceAgain,
} from '@libs/spaces-harness/space-unreachable';
import {
  lobbySpaceCardVisible,
  readSpaceLink,
  spaceRetryOffered,
  spaceUnreachableShown,
} from '@libs/spaces-harness/spaces-ui-reads';

const SECOND_MS = 1_000;
/** How long a precondition this setup just built may take to show. */
const SETTLES_MS = 20 * SECOND_MS;

Given(
  "{actor}'s lobby still lists a space {actor} hosted that no longer exists",
  async (w, actor: Actor, host: Actor) => {
    await w.s.apply(focusActor, host);
    await w.s.apply(createSpace, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} opened no space`);
    await w.s.apply(returnToLobby, host);
    await w.s.apply(forgetSpace, link);
    await w.s.apply(restartApp, host);
    // Precondition: the lobby still lists the space the product forgot.
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbySpaceCardVisible(surf, actor, link), {
      maxMs: SETTLES_MS,
    });
  }
);

Given("{actor}'s space no longer exists", async (w, actor: Actor) => {
  const link = await w.s.read(readSpaceLink, actor);
  if (link === null) throw new Error(`${actor} is in no space`);
  await w.s.apply(forgetSpace, link);
});

Given(
  "{actor} has been told the space can't be reached right now",
  async (w, actor: Actor) => {
    await w.s.apply(returnToOwnSpace, actor);
    await w.s.until((surf) => spaceUnreachableShown(surf, actor), {
      maxMs: SETTLES_MS,
    });
  }
);

Given(
  '{actor} has returned to their space while offline',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(returnToOwnSpace, actor);
  }
);

When('{actor} tries again', async (w, actor: Actor) => {
  await w.s.apply(tryReachingSpaceAgain, actor);
});

// "is still told" reads the same screen after trying again.
Then(
  "{actor} is (still )told the space can't be reached right now within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => spaceUnreachableShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is offered to try again', async (w, actor: Actor) => {
  expect(await w.s.read(spaceRetryOffered, actor)).toBe(true);
});
