import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';

const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;

export const acceptFriendRequest = scenarioAction({
  name: 'acceptFriendRequest',
  act: async (s, actorId: string, fromUsername: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabNotifications).tap();
    const card = Handles.notificationsFriendRequestCard(fromUsername);
    await ui.get(card).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await ui.get(accept).tap({ timeoutMs: WAIT_MS });
    await ui.get(accept).expect.hidden({ timeoutMs: HIDDEN_MS });
    await ui.get(card).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const openFriendsList = scenarioAction({
  name: 'openFriendsList',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).expect.visible({
      timeoutMs: WAIT_MS,
    });
    if (
      !(await ui.get(Handles.tabProfile).isVisible()) &&
      (await ui.get(Handles.navBack).isVisible())
    ) {
      await ui.get(Handles.navBack).tap();
    }
    await ui.get(Handles.tabProfile).tap();
    await ui.get(Handles.profileFriendsStats).expect.visible({
      timeoutMs: WAIT_MS,
    });
    await ui.get(Handles.profileFriendsStats).tap();
  },
});
