import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** What the link currently shows, including an unexpected joined screen. */
export async function spaceLinkView(s: ProductHarness, actorId: string) {
  const ui = await actorUi(s, actorId);
  const joinOffered = await ui.get(Handles.spaceJoin).isVisible();
  if (await ui.get(Handles.spaceEnded).isVisible())
    return { linkDestination: 'ended', joinOffered };
  if (await ui.get(Handles.spaceHostOffline).isVisible())
    return { linkDestination: 'host offline', joinOffered };
  if (await ui.get(Handles.spaceNotFound).isVisible())
    return { linkDestination: 'not found', joinOffered };
  if (joinOffered) return { linkDestination: 'open', joinOffered };
  if (await ui.get(Handles.spaceClose).isVisible())
    return { linkDestination: 'in space', joinOffered };
  return { linkDestination: 'none', joinOffered };
}
