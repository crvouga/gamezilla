import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { Handles } from '@libs/test-ids-shared/handles';

/**
 * The team stops allowing `name` as a space name. The rules ship with the
 * app, so every device and API instance has them at once, connected or not;
 * a space given the name keeps it.
 */
export const stopAllowingSpaceName = scenarioAction({
  name: 'stopAllowingSpaceName',
  act: async (s, name: string) => {
    s.harness.teamRules.stopAllowing('spaceTitle', name);
    await s.session.waitForIdle();
  },
});

/** The team starts allowing `name` as a space name again, everywhere. */
export const startAllowingSpaceName = scenarioAction({
  name: 'startAllowingSpaceName',
  act: async (s, name: string) => {
    s.harness.teamRules.startAllowing('spaceTitle', name);
    await s.session.waitForIdle();
  },
});

/** Close the rename dialog without saving (after a refused name). */
export const cancelRenameSpace = scenarioAction({
  name: 'cancelRenameSpace',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const cancel = ui.get(Handles.spaceRenameCancel);
    if (!(await cancel.isVisible())) return;
    await cancel.tap();
    await cancel.expect.hidden();
  },
});
