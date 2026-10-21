import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 10_000;

/** Tap the inbox tab: the person's notifications (or what a guest gets). */
export const openInbox = scenarioAction({
  name: 'openInbox',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).expect.visible({
      timeoutMs: WAIT_MS,
    });
    // From inside a space, or a screen stacked over the tabs, as a person
    // would: out of it first, to where the inbox tab is.
    if (!(await ui.get(Handles.tabNotifications).isVisible())) {
      if (await ui.get(Handles.spaceClose).isVisible()) {
        await ui.get(Handles.spaceClose).tap({ timeoutMs: WAIT_MS });
        await s.session.waitForIdle();
      }
      if (!(await ui.get(Handles.tabNotifications).isVisible()))
        await Promise.resolve(backToTabs.act(s, actorId));
    }
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

export const NOTIFICATIONS_HARNESS_ACTIONS = [openInbox];
