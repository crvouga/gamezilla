import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { Handles } from '@libs/test-ids-shared/handles';
import { SPACE_WAIT_MS, showSpacesTab, waitActiveSpace } from './space-ui';

export const returnToRetainedSpace = scenarioAction({
  name: 'returnToRetainedSpace',
  act: async (s, actor: string, link: string) => {
    const id = /^\/space\/([^/?#]+)/.exec(link)?.[1];
    if (id === undefined) throw new Error(`Not a space link: ${link}`);
    await showSpacesTab(s, actor);
    const ui = await actorUi(s, actor);
    await ui.get(Handles.spaceLobbyCard(id)).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitActiveSpace(s, actor);
  },
});
