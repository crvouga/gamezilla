import { actorUi, scenarioAction } from '@libs/harness/system/actor-ui';
import { Handles } from '@libs/test-ids';

const WAIT_MS = 10_000;

/** Tap the inbox tab: the person's notifications (or what a guest gets). */
export const openInbox = scenarioAction({
  name: 'openInbox',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).expect.visible({
      timeoutMs: WAIT_MS,
    });
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

export const NOTIFICATIONS_HARNESS_ACTIONS = [openInbox];
