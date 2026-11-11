import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorUsername } from '@libs/harness-ts/run-scope';
import { Handles } from '@libs/test-ids-shared-ts/handles';

export const keepShownRequest = scenarioAction({
  name: 'keepShownRequest',
  act: async (s, actor: string, from: string) => {
    const ui = await actorUi(s, actor);
    await ui.get(Handles.tabNotifications).tap();
    await ui
      .get(Handles.notificationsFriendRequestCard(actorUsername(s, from)))
      .tap();
    await ui
      .get(Handles.notificationsFriendRequestAccept(actorUsername(s, from)))
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
    await ui
      .get(Handles.notificationsFriendRequestAccept(actorUsername(s, from)))
      .tap();
    await s.session.waitForIdle();
  },
});

export async function requestDeletionReason(
  s: ProductHarness,
  actor: string,
  from: string
) {
  const ui = await actorUi(s, actor);
  return ui
    .get(Handles.notificationsFriendRequestAccept(actorUsername(s, from)))
    .text();
}
