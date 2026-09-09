import { Handles } from '@libs/test-ids';

import { actorUi } from './actor-ui';
import type { ProductSim } from './sim';

const TAB_HANDLES = [
  Handles.tabSpaces,
  Handles.tabSearch,
  Handles.tabNotifications,
  Handles.tabProfile,
] as const;

/** True when all four tab-shell handles are visible. */
export async function tabsVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  for (const handle of TAB_HANDLES) {
    if (!(await ui.get(handle).isVisible())) return false;
  }
  return true;
}

export async function readUsername(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = await ui.get(Handles.profileDisplayUsername).text();
    if (raw === null) return null;
    return raw.startsWith('@') ? raw.slice(1) : raw;
  } catch {
    return null;
  }
}

export async function readAvatarSeed(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarSeed).text();
  } catch {
    return null;
  }
}

export async function readAvatarStyleLabel(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarStyle).text();
  } catch {
    return null;
  }
}

export async function avatarTraitVisible(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.profileAvatarTrait).isVisible();
  } catch {
    return false;
  }
}

export async function friendRowVisible(
  s: ProductSim,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.friendsListRow(username)).isVisible();
  } catch {
    return false;
  }
}

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
