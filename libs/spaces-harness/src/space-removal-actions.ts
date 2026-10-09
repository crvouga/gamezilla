import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { Handles } from '@libs/test-ids-shared/handles';
import { SPACE_WAIT_MS, tapChromeOrOverflow } from './space-ui';

export const openSpaceShare = scenarioAction({
  name: 'openSpaceShare',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (!(await ui.get(Handles.spaceShareClose).isVisible()))
      await tapChromeOrOverflow(s, actor, Handles.spaceShare);
  },
});

export const removePersonFromSpace = scenarioAction({
  name: 'removePersonFromSpace',
  act: async (s, actor: string, memberId: string) => {
    await Promise.resolve(openSpaceShare.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui
      .get(Handles.spaceRemovePerson(memberId))
      .tap({ timeoutMs: SPACE_WAIT_MS });
    await ui.get(Handles.spaceRemoveConfirm).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui
      .get(Handles.spaceRemoveConfirm)
      .expect.hidden({ timeoutMs: SPACE_WAIT_MS });
  },
});

export const closeSpaceShare = scenarioAction({
  name: 'closeSpaceShare',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (await ui.get(Handles.spaceRemoveSuccess).isVisible())
      await ui
        .get(Handles.spaceMutationDismiss)
        .tap({ timeoutMs: SPACE_WAIT_MS });
    await ui.get(Handles.spaceShareClose).tap({ timeoutMs: SPACE_WAIT_MS });
  },
});
