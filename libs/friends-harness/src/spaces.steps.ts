/**
 * Spaces steps (`specs/spaces/`), hosted here because friends is the lowest
 * package whose harness composes spaces with everything it needs (see
 * tests/harness/open-friends-harness.ts). Chess reuses them.
 */

import { expect } from 'bun:test';

import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { letTimePass, restartApp } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { recall, remember } from '@libs/harness/spec-world';
import {
  nameEveryoneSeesOf,
  standInNameOf,
} from '@libs/profile-harness/profile-ui-reads';
import {
  closeSpaceMembers,
  closeSpaceScreen,
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
} from '@libs/spaces-harness/space-actions';
import { spaceNamedAfterShown } from '@libs/spaces-harness/space-name-reads';
import {
  startAllowingSpaceName,
  stopAllowingSpaceName,
} from '@libs/spaces-harness/space-name-rule-actions';
import { returnToRetainedSpace } from '@libs/spaces-harness/space-retained-actions';
import { spacePresenceDiagnostics } from '@libs/spaces-harness/space-screen-read';
import {
  activeSpaceVisible,
  backToSpacesOffered,
  hostedSpaceCount,
  hostingLimitShown,
  joinOffered,
  lobbyCardVisible,
  lobbySpaceCardText,
  lobbySpaceCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
  renameOffered,
  spaceEndedShown,
  spaceNameRefusalShown,
  spaceNotFoundShown,
  spacesNeedConnectionShown,
  spaceTitleShown,
} from '@libs/spaces-harness/spaces-ui-reads';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
/** Lobby cards and presence settle on the same virtual budget. */
const PRESENCE_SETTLES_MS = 20 * SECOND_MS;
/** A link to a space that was never created. */
const NO_SUCH_SPACE_LINK = '/space/no-such-space';
const SPACE_LINK = 'spaceLink';

export function rememberedSpaceLink(w: HarnessWorld): string {
  return recall(w, SPACE_LINK) as string;
}
const SPACE_HOST = 'spaceHost';
const SPACE_GUESTS = 'spaceGuests';

/** The guests an earlier step had join the host's space, in order. */
export function rememberedSpaceGuests(w: HarnessWorld): readonly Actor[] {
  return (w.memo.get(SPACE_GUESTS) as readonly Actor[] | undefined) ?? [];
}

function rememberSpaceGuest(w: HarnessWorld, guest: Actor): void {
  remember(w, SPACE_GUESTS, [...rememberedSpaceGuests(w), guest]);
}
const hostSpaceLinkKey = (host: Actor) => `hostSpaceLink:${host}`;

async function spaceLinkForHost(w: HarnessWorld, host: Actor): Promise<string> {
  const remembered = w.memo.get(hostSpaceLinkKey(host));
  if (typeof remembered === 'string') return remembered;
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no shared space link`);
  return link;
}

/**
 * Into `host`'s live space from `actor`'s lobby card, once it lists it.
 * An ended space is not listed: the same join then has nothing to open,
 * and the scenario says whether a join was offered.
 */
async function joinHostFromLobby(
  w: HarnessWorld,
  actor: Actor,
  host: Actor
): Promise<void> {
  await w.s.apply(openSpacesTab, actor);
  if (!(await hostCardListed(w, actor, host))) return;
  await w.s.apply(joinFromLobby, actor, host);
}

/** The card has the presence window to sync. Absence after that is final. */
async function hostCardListed(
  w: HarnessWorld,
  actor: Actor,
  host: Actor
): Promise<boolean> {
  try {
    await w.s.until((surf) => lobbyCardVisible(surf, actor, host), {
      maxMs: PRESENCE_SETTLES_MS,
    });
    return true;
  } catch (error) {
    if (!lobbyWaitElapsed(error)) throw error;
    return false;
  }
}

function lobbyWaitElapsed(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('until: predicate not met')
  );
}

async function shareLink(w: HarnessWorld, host: Actor): Promise<string> {
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  remember(w, SPACE_HOST, host);
  remember(w, hostSpaceLinkKey(host), link);
  return remember(w, SPACE_LINK, link);
}

/** Open `actor`'s members sheet until it counts `count` people. */
async function untilPresence(
  w: HarnessWorld,
  actor: Actor,
  count: number,
  maxMs: number
): Promise<void> {
  if (!(await w.s.read(activeSpaceVisible, actor)))
    await w.s.apply(openSpaceLink, actor, rememberedSpaceLink(w));
  await w.s.apply(openSpaceMembers, actor);
  try {
    await w.s.until((surf) => readSpacePresenceCount(surf, actor), {
      pred: (n) => n === count,
      maxMs,
    });
  } catch (cause) {
    throw new Error(await w.s.read(spacePresenceDiagnostics), { cause });
  }
  await w.s.apply(closeSpaceMembers, actor);
}

/** `host` creates a space; its link is kept for anyone who joins from it. */
async function hostSpace(w: HarnessWorld, host: Actor): Promise<void> {
  await w.s.apply(focusActor, host);
  await w.s.apply(createSpace, host);
  await shareLink(w, host);
}

// ------------------------------------------------------------------- host

// A Plus membership lifts the hosting limit.
Given('{actor} is a Plus member', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
});

// A state, not an event: someone the scenario already gave a space is
// hosting it, and is taken back into it rather than refused a second one.
Given('{actor} is hosting a space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openSpacesTab, actor);
  if ((await w.s.read(hostedSpaceCount, actor)) === 0) {
    await hostSpace(w, actor);
    return;
  }
  await w.s.apply(returnToOwnSpace, actor);
  await shareLink(w, actor);
});

Given(
  '{actor} is hosting {int} spaces',
  async (w, actor: Actor, count: number) => {
    for (let index = 0; index < count; index++) await hostSpace(w, actor);
  }
);

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

/** The invite can land on the device that tried to host, or on the phone. */
async function hostingInviteVisible(
  s: Parameters<typeof hostingLimitShown>[0],
  actor: Actor
): Promise<boolean> {
  if (await hostingLimitShown(s, actor)) return true;
  const device = otherDevice(actor);
  if (!s.actors.has(device)) return false;
  return hostingLimitShown(s, device);
}

Then(
  '{actor} is told their hosting limit is reached and invited to get Plus',
  async (w, actor: Actor) => {
    await w.s.until((surf) => hostingInviteVisible(surf, actor), {
      maxMs: PRESENCE_SETTLES_MS,
    });
  }
);

Then('{actor} is not invited to get Plus', async (w, actor: Actor) => {
  expect(await w.s.read(hostingLimitShown, actor)).toBe(false);
});

// The Spaces screen says how many live spaces the host has.
Then('{actor} hosts {int} space(s)', async (w, actor: Actor, count: number) => {
  await w.s.apply(openSpacesTab, actor);
  await w.s.until((surf) => hostedSpaceCount(surf, actor), {
    pred: (hosted) => hosted === count,
    maxMs: PRESENCE_SETTLES_MS,
  });
});

Then(
  '{actor} is told joining needs a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => spacesNeedConnectionShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

When('{actor} goes back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When('{actor} steps out of the space', async (w, actor: Actor) => {
  await w.s.apply(closeSpaceScreen, actor);
});

Given('{actor} has gone back to the lobby', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When('{actor} returns to their space', async (w, actor: Actor) => {
  const link = w.memo.get(hostSpaceLinkKey(actor));
  if (typeof link === 'string')
    await w.s.apply(returnToRetainedSpace, actor, link);
  else await w.s.apply(returnToOwnSpace, actor);
});

Then(
  "{actor}'s lobby lists {actor}'s space",
  async (w, actor: Actor, host: Actor) => {
    const link = await spaceLinkForHost(w, host);
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbySpaceCardVisible(surf, actor, link), {
      maxMs: PRESENCE_SETTLES_MS,
    });
  }
);

Then(
  "{actor}'s lobby stops listing {actor}'s space within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const link = await spaceLinkForHost(w, host);
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbySpaceCardVisible(surf, actor, link), {
      pred: (listed) => !listed,
      maxMs: seconds * SECOND_MS,
    });
    expect(await w.s.read(lobbySpaceCardVisible, actor, link)).toBe(false);
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

Given("{actor} has opened {actor}'s space link", async (w, actor: Actor) => {
  await w.s.apply(openSpaceLink, actor, recall(w, SPACE_LINK) as string);
});

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
  await w.s.apply(openSpaceLink, actor, recall(w, SPACE_LINK) as string);
});

Given(
  '{actor} has opened a link to a space that does not exist',
  async (w, actor: Actor) => {
    remember(w, SPACE_LINK, NO_SUCH_SPACE_LINK);
    await w.s.apply(openSpaceLink, actor, NO_SUCH_SPACE_LINK);
  }
);

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
    rememberSpaceGuest(w, guest);
    // Precondition: both are there before the scenario acts.
    await untilPresence(w, host, 2, PRESENCE_SETTLES_MS);
  }
);

Given(
  '{actor} is hosting a space that {actor} joined from the lobby',
  async (w, host: Actor, guest: Actor) => {
    await hostSpace(w, host);
    await joinHostFromLobby(w, guest, host);
    rememberSpaceGuest(w, guest);
  }
);

When('{actor} leaves the space', async (w, actor: Actor) => {
  await w.s.apply(leaveSpace, actor);
});

Given('{actor} has left the space', async (w, actor: Actor) => {
  await w.s.apply(leaveSpace, actor);
});

Given(
  '{actor} has lost the connection long enough to drop out of the space',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(letTimePass, 2 * SECOND_MS);
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
  await w.s.until((surf) => activeSpaceVisible(surf, actor), {
    pred: (visible) => !visible,
  });
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

When('{actor} clears the space name', async (w, actor: Actor) => {
  await w.s.apply(renameSpace, actor, '');
});

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
    const link = await spaceLinkForHost(w, host);
    await w.s.apply(openSpacesTab, actor);
    await w.s.until((surf) => lobbySpaceCardText(surf, actor, link), {
      pred: (text) => text?.includes(title) === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Given(
  '{actor} has renamed the space to {string}',
  async (w, actor: Actor, title: string) => {
    await w.s.apply(renameSpace, actor, title);
    if (await w.s.read(spaceNameRefusalShown, actor)) {
      throw new Error(`${actor} could not name the space "${title}"`);
    }
  }
);

Then(
  '{actor} is told that space name is not allowed',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => spaceNameRefusalShown(surf, actor));
  }
);

Then(
  '{actor} still sees the space is called {string}',
  async (w, actor: Actor, title: string) => {
    await w.s.apply(focusActor, actor);
    expect(await w.s.read(spaceTitleShown, actor)).toBe(title);
  }
);

When(
  'the team stops allowing the space name {string}',
  async (w, name: string) => {
    await w.s.apply(stopAllowingSpaceName, name);
  }
);

Given(
  'the team has stopped allowing the space name {string}',
  async (w, name: string) => {
    await w.s.apply(stopAllowingSpaceName, name);
  }
);

When(
  'the team starts allowing the space name {string} again',
  async (w, name: string) => {
    await w.s.apply(startAllowingSpaceName, name);
  }
);

Then(
  '{actor} sees the space is named after {actor} within {int} seconds',
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const hostName = await w.s.read(nameEveryoneSeesOf, host);
    if (hostName === null) throw new Error(`${host} has no name yet`);
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => spaceNamedAfterShown(surf, actor, hostName), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor} sees the space is named after {actor}'s stand-in name within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const standIn = await w.s.read(standInNameOf, host);
    if (standIn === null) throw new Error(`${host} has no profile yet`);
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => spaceNamedAfterShown(surf, actor, standIn), {
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

Then('{actor} is offered to join', async (w, actor: Actor) => {
  try {
    await w.s.until((s) => joinOffered(s, actor), {
      maxMs: PRESENCE_SETTLES_MS,
    });
  } catch (error) {
    const detail = await w.s.read(spacePresenceDiagnostics);
    throw new Error(`${String(error)}; ${detail}`, { cause: error });
  }
});
