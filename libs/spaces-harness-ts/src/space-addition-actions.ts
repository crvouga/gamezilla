import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openSpaceShare } from './space-removal-actions';
import { SPACE_WAIT_MS } from './space-ui';

export const openSpacePersonPicker = scenarioAction({
  name: 'openSpacePersonPicker',
  act: async (s, host: string, name: string) => {
    await Promise.resolve(openSpaceShare.act(s, host));
    const ui = await actorUi(s, host);
    await ui.get(Handles.spaceAddTrigger).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui.get(Handles.spaceAddQuery).clear();
    await ui
      .get(Handles.spaceAddQuery)
      .input(name, { timeoutMs: SPACE_WAIT_MS });
    await s.session.waitForIdle();
  },
});

export const addPersonToSpace = scenarioAction({
  name: 'addPersonToSpace',
  act: async (s, host: string, personId: string, name: string) => {
    await Promise.resolve(openSpacePersonPicker.act(s, host, name));
    const ui = await actorUi(s, host);
    await ui
      .get(Handles.spaceAddPerson(personId))
      .tap({ timeoutMs: SPACE_WAIT_MS });
    await ui
      .get(Handles.spaceAddQuery)
      .expect.hidden({ timeoutMs: SPACE_WAIT_MS });
  },
});
