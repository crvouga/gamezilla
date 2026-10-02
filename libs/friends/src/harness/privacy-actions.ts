import { actorUi, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { Handles } from '@libs/test-ids';

export const keepShownRequest = scenarioAction({
  name: 'keepShownRequest',
  act: async (s, actor: string, from: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(Handles.tabNotifications).tap();
    await ui.get(Handles.notificationsFriendRequestCard(from)).tap();
    await ui
      .get(Handles.notificationsFriendRequestAccept(from))
      .expect.visible();
    await s.session.advanceTime(1_000);
    await s.session.waitForIdle();
    await s.harness.drainServerFetch();
    // Delay updates to an already shown request while HTTP through the balancer remains available.
    s.harness.partition(`${actor}:events`, 'server-a');
  },
});

export const acceptShownRequest = scenarioAction({
  name: 'acceptShownRequest',
  act: async (s, actor: string, from: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(Handles.notificationsFriendRequestAccept(from)).tap();
    await s.session.waitForIdle();
  },
});

export async function requestDeletionReason(
  s: ProductHarness,
  actor: string,
  from: string
) {
  const ui = await actorUi(s, actor);
  return ui.get(Handles.notificationsFriendRequestAccept(from)).text();
}
