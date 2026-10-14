import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

async function markerText(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<string | null> {
  try {
    await bringToFront(s, actorId);
    return await actorUi(s, actorId).then((ui) => ui.get(handle).text());
  } catch {
    return null;
  }
}

async function markerVisible(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<boolean> {
  try {
    await bringToFront(s, actorId);
    const ui = await actorUi(s, actorId);
    return await ui.get(handle).isVisible();
  } catch {
    return false;
  }
}

/** `observer` can see that `memberId` is idle. */
export function personIdleShown(
  s: ProductHarness,
  observerId: string,
  memberId: string
): Promise<boolean> {
  return markerVisible(s, observerId, Handles.spaceMemberIdle(memberId));
}

/** How many times `observer`'s presence counts `memberId`. */
export async function personPresenceCount(
  s: ProductHarness,
  observerId: string,
  memberId: string
): Promise<number> {
  const raw = await markerText(s, observerId, Handles.spacePerson(memberId));
  const count = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(count) ? count : 0;
}

/** Room time of this device's last activity, or null when it has none. */
export async function ownActivityAt(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const raw = (await markerText(s, actorId, Handles.spaceOwnActivity))?.trim();
  if (raw === undefined || raw.length === 0) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}
