import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import { showKnownPerson } from './known-person-view';

export async function requestWaitingToShare(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  return ui.get(Handles.friendRequestPending).isVisible();
}

export async function requestUnavailableRefusal(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const text = await ui.get(Handles.friendRequestRefusal).text();
  return text?.includes('the person is unavailable') === true;
}

export async function requestRefusalShown(
  s: ProductHarness,
  actor: string,
  other: string
): Promise<boolean> {
  await showKnownPerson(s, actor, other);
  const ui = await actorUi(s, actor);
  return (
    (await ui.get(Handles.friendRequestRefusal).isVisible()) ||
    (await ui.get(Handles.friendAdd(other)).text()) === 'Try again later'
  );
}

export async function blockRevealed(
  s: ProductHarness,
  actor: string,
  other: string
): Promise<boolean> {
  await showKnownPerson(s, actor, other);
  const ui = await actorUi(s, actor);
  const text = await ui.get(Handles.friendRequestRefusal).text();
  return /block/i.test(text ?? '');
}
