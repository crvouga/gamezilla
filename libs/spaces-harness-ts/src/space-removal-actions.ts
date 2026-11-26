import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { SPACE_WAIT_MS, tapSpaceAction } from './space-ui';

export const openSpaceShare = scenarioAction({
  name: 'openSpaceShare',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (await ui.get(Handles.spaceShareClose).isVisible()) return;
    if (!(await ui.get(Handles.spaceMembersClose).isVisible()))
      await tapSpaceAction(s, actor, Handles.spaceMembersButton);
    await ui
      .get(`${Handles.spaceManagementTabs}-sharing`)
      .tap({ timeoutMs: SPACE_WAIT_MS });
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
