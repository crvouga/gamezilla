/**
 * Spaces steps, hosted here because spaces' server SQL reads friends' tables
 * (see tests/e2e/support/open-friends-sim.ts): the lowest package that
 * composes spaces soundly. Features live under `features/spaces/`.
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
import { recall, remember } from '@libs/sim-harness/spec/world';
import { visible } from '@libs/sim-harness/system/observations';
import {
  closeSpaceMembers,
  closeSpaceScreen,
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
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';

const SECOND_MS = 1_000;
const SPACE_LINK = 'spaceLink';

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
  return remember(w, SPACE_LINK, link);
}

// ------------------------------------------------------------------- host

When('{actor} creates a space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(createSpace, actor);
});

When('{actor} goes back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When('{actor} reopens their live space', async (w, actor: Actor) => {
  await w.s.apply(reenterActiveSpace, actor, actor);
});

Then(
  "{actor}'s lobby lists {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    await w.s.until((surf) => lobbyCardVisible(surf, actor, host));
    expect(await w.s.read(lobbyCardVisible, actor, host)).toBe(true);
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

When('{actor} returns to their space and ends it', async (w, actor: Actor) => {
  await w.s.apply(reenterActiveSpace, actor, actor);
  await w.s.apply(endSpace, actor);
});

// ------------------------------------------------------------------ joining

Then('{actor} has a link to the space', async (w, host: Actor) => {
  expect(await shareLink(w, host)).toMatch(/^\/space\/.+/);
});

When('{actor} joins the space from the link', async (w, actor: Actor) => {
  await w.s.apply(openSpaceLink, actor, recall(w, SPACE_LINK) as string);
  await w.s.apply(joinFromPrompt, actor);
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

When('{actor} steps out of the space', async (w, actor: Actor) => {
  await w.s.apply(closeSpaceScreen, actor);
});

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
    await w.s.apply(openSpaceMembers, actor);
    await w.s.until((surf) => readSpacePresenceCount(surf, actor), {
      pred: (n) => n === count,
      maxMs: seconds * SECOND_MS,
    });
    await w.s.apply(closeSpaceMembers, actor);
  }
);

Then(
  '{actor} sees the space has ended within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => visible(surf, actor, [Handles.spaceEnded]), {
      maxMs: seconds * SECOND_MS,
    });
    expect(await w.s.read(visible, actor, [Handles.spaceEnded])).toBe(true);
  }
);

Then('{actor} is not offered to join', async (w, actor: Actor) => {
  expect(await w.s.read(visible, actor, [Handles.spaceJoin])).toBe(false);
});
