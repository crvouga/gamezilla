import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { createSpace, openSpaceLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids-shared/handles';

/** A real online-only choice: joining another person's existing space. */
export const prepareSharedChoice = scenarioAction({
  name: 'prepareSharedChoice',
  act: async (s, actor: string) => {
    await Promise.resolve(createSpace.act(s, 'bob'));
    const link = await readSpaceLink(s, 'bob');
    if (link === null) throw new Error('The host has no space link');
    await Promise.resolve(openSpaceLink.act(s, actor, link));
  },
});

export async function sharedChoiceLink(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const link = await s.actors.get(actor)?.currentPath();
  if (link === undefined || !link.startsWith('/space/'))
    throw new Error('The shared choice is not open');
  return link;
}

export const attemptSharedChoice = scenarioAction({
  name: 'attemptSharedChoice',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: 15_000 });
    await s.session.waitForIdle();
  },
});

export async function sharedChoiceCanBePutAside(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return (
    (await ui.get(Handles.navBack).isVisible()) ||
    (await ui.get(Handles.spaceClose).isVisible())
  );
}

export async function sharedChoiceOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  const button = ui.get(Handles.spaceJoin);
  return (
    (await button.isVisible()) && (await button.attribute('disabled')) === null
  );
}
