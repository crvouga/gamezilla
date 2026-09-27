import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

export async function lobbyCardVisible(
  s: ProductSim,
  actorId: string,
  hostUsername: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceCard(hostUsername)).isVisible();
  } catch {
    return false;
  }
}

export async function activeSpaceVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceClose).isVisible();
  } catch {
    return false;
  }
}

export async function spaceMemberVisible(
  s: ProductSim,
  actorId: string,
  memberId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceMemberRow(memberId)).isVisible();
  } catch {
    return false;
  }
}

export async function spacePresenceCount(
  s: ProductSim,
  actorId: string
): Promise<number> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = (await ui.get(Handles.spacePresenceCount).text()) ?? '';
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * The link the actor's open space is at (`/space/<id>`) — what its Copy link
 * button hands out — or `null` outside a space.
 */
export async function readSpaceLink(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const actor = s.actors.get(actorId);
  if (actor === undefined) return null;
  const path = await actor.currentPath();
  return /^\/space\/[^/?#]+/.exec(path)?.[0] ?? null;
}

/**
 * People connected to the space, as the members sheet counts them (its
 * hidden count probe), or `null` while the sheet is closed.
 */
export async function readSpacePresenceCount(
  s: ProductSim,
  actorId: string
): Promise<number | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = await ui.get(Handles.spacePresenceCount).text();
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** The actor's app says the space they were in has ended. */
export async function spaceEndedShown(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceEnded).isVisible();
  } catch {
    return false;
  }
}

/** The actor's app offers to join a space. */
export async function joinOffered(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.spaceJoin).isVisible();
  } catch {
    return false;
  }
}
