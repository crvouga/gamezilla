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
