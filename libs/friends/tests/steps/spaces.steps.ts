/**
 * Spaces steps (`specs/spaces/`), hosted here because friends is the lowest
 * package whose harness composes spaces with everything it needs (see
 * tests/harness/open-friends-harness.ts). Chess reuses them.
 */

import { expect } from 'bun:test';

import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing/harness/billing-actions';
import { focusActor, signInWithGoogle } from '@libs/harness';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import { cutConnection } from '@libs/harness/spec/steps/platform';
import { recall, remember } from '@libs/harness/spec/world';
import { letTimePass, restartApp } from '@libs/harness/system/actions';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinFromLobby,
  joinViaLink,
  leaveSpace,
  openSpaceLink,
  openSpaceMembers,
  openSpaceMenu,
  openSpacesTab,
  renameSpace,
  reopenSpaceLink,
  returnToLobby,
  returnToOwnSpace,
  startSpace,
} from '@libs/spaces/harness/space-actions';
import {
  activeSpaceVisible,
  backToSpacesOffered,
  hostedSpaceCount,
  hostingLimitShown,
  joinOffered,
  lobbyCardText,
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
  renameOffered,
  spaceEndedShown,
  spaceNotFoundShown,
  spacesNeedConnectionShown,
  spaceTitleShown,
} from '@libs/spaces/harness/spaces-ui-reads';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
/** A link to a space that was never created. */
const NO_SUCH_SPACE_LINK = '/space/no-such-space';
const SPACE_LINK = 'spaceLink';
const SPACE_HOST = 'spaceHost';

/** Into `host`'s live space from `actor`'s lobby card, once it lists it. */
async function joinHostFromLobby(
  w: HarnessWorld,
  actor: Actor,
  host: Actor
): Promise<void> {
  await w.s.apply(openSpacesTab, actor);
  await w.s.until((surf) => lobbyCardVisible(surf, actor, host));
  await w.s.apply(joinFromLobby, actor, host);
}

async function shareLink(w: HarnessWorld, host: Actor): Promise<string> {
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  remember(w, SPACE_HOST, host);
  return remember(w, SPACE_LINK, link);
}

/** Open `actor`'s members sheet until it counts `count` people. */
async function untilPresence(
  w: HarnessWorld,
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
async function hostSpace(w: HarnessWorld, host: Actor): Promise<void> {
  await w.s.apply(focusActor, host);
  await w.s.apply(createSpace, host);
  await shareLink(w, host);
}

const PRESENCE_SETTLES_MS = 20 * SECOND_MS;

// ------------------------------------------------------------------- host

// A Plus membership lifts the hosting limit.
Given('{actor} is a Plus member', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
});

Given('{actor} is hosting a space', async (w, actor: Actor) => {
  await hostSpace(w, actor);
});

When('{actor} creates a space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(startSpace, actor);
});

When('{actor} creates another space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(startSpace, actor);
});

Given('{actor} has hosted a space and ended it', async (w, actor: Actor) => {
  await hostSpace(w, actor);
  await w.s.apply(endSpace, actor);
});

Then(
  '{actor} is invited to get Plus to host more spaces',
  async (w, actor: Actor) => {
    expect(await w.s.read(hostingLimitShown, actor)).toBe(true);
  }
);

Then('{actor} is not invited to get Plus', async (w, actor: Actor) => {
  expect(await w.s.read(hostingLimitShown, actor)).toBe(false);
});

// The Spaces screen says how many live spaces the host has.
Then('{actor} hosts {int} space(s)', async (w, actor: Actor, count: number) => {
  await w.s.apply(openSpacesTab, actor);
  expect(await w.s.read(hostedSpaceCount, actor)).toBe(count);
});

Then(
  '{actor} is told spaces need a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => spacesNeedConnectionShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

When('{actor} goes back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

Given('{actor} has gone back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When('{actor} returns to their space', async (w, actor: Actor) => {
  await w.s.apply(returnToOwnSpace, actor);
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

/** `actor` opens the shared space link and joins when it offers to. */
export async function joinSpaceFromLink(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  await w.s.apply(joinViaLink, actor, recall(w, SPACE_LINK) as string);
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
    await joinHostFromLobby(w, actor, host);
  }
);

When(
  '{actor} opens a link to a space that does not exist',
  async (w, actor: Actor) => {
    await w.s.apply(openSpaceLink, actor, NO_SUCH_SPACE_LINK);
  }
);

Then(
  '{actor} is told the space cannot be found within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => spaceNotFoundShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is offered the way back to Spaces', async (w, actor: Actor) => {
  expect(await w.s.read(backToSpacesOffered, actor)).toBe(true);
});

Given(
  '{actor} is hosting a space that {actor} joined from the link',
  async (w, host: Actor, guest: Actor) => {
    await w.s.apply(createSpace, host);
    await w.s.apply(joinViaLink, guest, await shareLink(w, host));
    // Precondition: both are there before the scenario acts.
    await untilPresence(w, host, 2, PRESENCE_SETTLES_MS);
  }
);

Given(
  '{actor} is hosting a space that {actor} joined from the lobby',
  async (w, host: Actor, guest: Actor) => {
    await hostSpace(w, host);
    await joinHostFromLobby(w, guest, host);
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
  '{actor} has been without a connection for {int} minutes',
  async (w, actor: Actor, minutes: number) => {
    await cutConnection(w, actor);
    await w.s.apply(letTimePass, minutes * MINUTE_MS);
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

// ------------------------------------------------------------------ rename

When(
  '{actor} renames the space to {string}',
  async (w, actor: Actor, title: string) => {
    await w.s.apply(renameSpace, actor, title);
  }
);

Then(
  '{actor} sees the space is called {string} within {int} seconds',
  async (w, actor: Actor, title: string, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => spaceTitleShown(surf, actor), {
      pred: (shown) => shown === title,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s lobby lists {actor}'s space as {string} within {int} seconds",
  async (
    w,
    ...[actor, host, title, seconds]: [Actor, Actor, string, number]
  ) => {
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbyCardText(surf, actor, host), {
      pred: (text) => text?.includes(title) === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);

// Renaming lives in the space's menu; the observer opens it to look.
Then('{actor} can rename the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openSpaceMenu, actor);
  expect(await w.s.read(renameOffered, actor)).toBe(true);
});

Then('{actor} cannot rename the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openSpaceMenu, actor);
  expect(await w.s.read(renameOffered, actor)).toBe(false);
});
