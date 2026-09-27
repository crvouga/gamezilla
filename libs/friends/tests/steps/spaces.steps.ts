/**
 * Spaces steps (`specs/spaces/`), hosted here because friends is the lowest
 * package whose sim composes spaces with everything it needs (see
 * tests/e2e/support/open-friends-sim.ts). Chess reuses them.
 */

import { expect } from 'bun:test';

import { focusActor } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { cutConnection } from '@libs/sim-harness/spec/steps/platform';
import { recall, remember } from '@libs/sim-harness/spec/world';
import { restartApp } from '@libs/sim-harness/system/actions';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinFromPrompt,
  leaveSpace,
  openLobbyCard,
  openSpaceLink,
  openSpaceMembers,
  openSpacesTab,
  reenterActiveSpace,
  reopenSpaceLink,
  returnToLobby,
} from '@libs/spaces/sim/space-actions';
import {
  activeSpaceVisible,
  joinOffered,
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
  spaceEndedShown,
} from '@libs/spaces/sim/spaces-ui-reads';

const SECOND_MS = 1_000;
const SPACE_LINK = 'spaceLink';
const SPACE_HOST = 'spaceHost';

async function joinFromLobby(
  w: SimWorld,
  actor: Actor,
  host: Actor
): Promise<void> {
  await w.s.apply(openSpacesTab, actor);
  await w.s.until((surf) => lobbyCardVisible(surf, actor, host));
  await w.s.apply(openLobbyCard, actor, host);
  await w.s.apply(joinFromPrompt, actor);
}

async function shareLink(w: SimWorld, host: Actor): Promise<string> {
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  remember(w, SPACE_HOST, host);
  return remember(w, SPACE_LINK, link);
}

/** Open `actor`'s members sheet until it counts `count` people. */
async function untilPresence(
  w: SimWorld,
  actor: Actor,
  count: number,
  maxMs: number
): Promise<void> {
  await w.s.apply(openSpaceMembers, actor);
  await w.s.until((surf) => readSpacePresenceCount(surf, actor), {
    pred: (n) => n === count,
    maxMs,
  });
  await w.s.apply(closeSpaceMembers, actor);
}

/** `host` creates a space; its link is kept for anyone who joins from it. */
async function hostSpace(w: SimWorld, host: Actor): Promise<void> {
  await w.s.apply(focusActor, host);
  await w.s.apply(createSpace, host);
  await shareLink(w, host);
}

const PRESENCE_SETTLES_MS = 20 * SECOND_MS;

// ------------------------------------------------------------------- host

Given('{actor} is hosting a space', async (w, actor: Actor) => {
  await hostSpace(w, actor);
});

When('{actor} creates a space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(createSpace, actor);
});

When('{actor} goes back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

Given('{actor} has gone back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When('{actor} reopens their live space', async (w, actor: Actor) => {
  await w.s.apply(reenterActiveSpace, actor, actor);
});

Then(
  "{actor}'s lobby lists {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    await w.s.until((surf) => lobbyCardVisible(surf, actor, host));
  }
);

Then(
  "{actor}'s lobby stops listing {actor}'s space within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbyCardVisible(surf, actor, host), {
      pred: (listed) => !listed,
      maxMs: seconds * SECOND_MS,
    });
    expect(await w.s.read(lobbyCardVisible, actor, host)).toBe(false);
  }
);

When('{actor} ends the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(endSpace, actor);
});

Given('{actor} has ended the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(endSpace, actor);
});

// ------------------------------------------------------------------ joining

/** `actor` opens the shared space link and joins from its prompt. */
export async function joinSpaceFromLink(
  w: SimWorld,
  actor: Actor
): Promise<void> {
  await w.s.apply(openSpaceLink, actor, recall(w, SPACE_LINK) as string);
  await w.s.apply(joinFromPrompt, actor);
}

When('{actor} joins the space from the link', async (w, actor: Actor) => {
  await joinSpaceFromLink(w, actor);
});

When('{actor} opens the space link again', async (w, actor: Actor) => {
  await w.s.apply(reopenSpaceLink, actor, recall(w, SPACE_LINK) as string);
});

When(
  "{actor} joins {actor}'s space from the lobby",
  async (w, actor: Actor, host: Actor) => {
    await joinFromLobby(w, actor, host);
  }
);

Given(
  '{actor} is hosting a space that {actor} joined from the link',
  async (w, host: Actor, guest: Actor) => {
    await w.s.apply(createSpace, host);
    await w.s.apply(openSpaceLink, guest, await shareLink(w, host));
    await w.s.apply(joinFromPrompt, guest);
    // Precondition: both are there before the scenario acts.
    await untilPresence(w, host, 2, PRESENCE_SETTLES_MS);
  }
);

Given(
  '{actor} is hosting a space that {actor} joined from the lobby',
  async (w, host: Actor, guest: Actor) => {
    await w.s.apply(createSpace, host);
    await joinFromLobby(w, guest, host);
  }
);

When('{actor} leaves the space', async (w, actor: Actor) => {
  await w.s.apply(leaveSpace, actor);
});

Given(
  '{actor} has lost the connection long enough to drop out of the space',
  async (w, actor: Actor) => {
    const host = recall(w, SPACE_HOST) as Actor;
    await cutConnection(w, actor);
    await untilPresence(w, host, 1, PRESENCE_SETTLES_MS);
  }
);

Given(
  '{actor} has come back to the space after closing the app',
  async (w, actor: Actor) => {
    await w.s.apply(restartApp, actor);
    await w.s.apply(reopenSpaceLink, actor, recall(w, SPACE_LINK) as string);
  }
);

// ---------------------------------------------------------------- in space

Then('{actor} is in the space', async (w, actor: Actor) => {
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});

Then('{actor} is not in a space', async (w, actor: Actor) => {
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(false);
});

Then(
  '{actor} sees {int} people/person in the space within {int} seconds',
  async (w, actor: Actor, count: number, seconds: number) => {
    await untilPresence(w, actor, count, seconds * SECOND_MS);
  }
);

Then(
  '{actor} sees the space has ended within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => spaceEndedShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is not offered to join', async (w, actor: Actor) => {
  expect(await w.s.read(joinOffered, actor)).toBe(false);
});
