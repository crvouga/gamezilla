import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

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
