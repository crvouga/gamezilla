import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
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
  const add = ui.get(Handles.friendAdd(other));
  return (
    (await ui.get(Handles.friendRequestRefusal).isVisible()) ||
    ((await add.isVisible()) && (await add.text()) === 'Try again later')
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
