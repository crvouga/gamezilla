import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';
import {
  confirmSpaceMutation,
  leaveToLobby,
  reenterSpace,
  SCREEN_SPACE_ENDED,
  SPACE_HIDDEN_MS,
  SPACE_WAIT_MS,
  showSpacesTab,
  tapChromeAction,
  tapLobbyCard,
  waitActiveSpace,
  waitForLobbyCard,
} from './space-ui';

export const openSpacesTab = scenarioAction({
  name: 'openSpacesTab',
  act: showSpacesTab,
});

export const createSpace = scenarioAction({
  name: 'createSpace',
  act: async (s, actorId: string) => {
    await showSpacesTab(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceCreate).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitActiveSpace(s, actorId);
  },
});

export const returnToLobby = scenarioAction({
  name: 'returnToLobby',
  act: leaveToLobby,
});

export const expectLobbyCard = scenarioAction({
  name: 'expectLobbyCard',
  act: async (s, actorId: string, hostUsername: string) => {
    await waitForLobbyCard(s, actorId, hostUsername);
  },
});

export const openLobbyCard = scenarioAction({
  name: 'openLobbyCard',
  act: async (s, actorId: string, hostUsername: string) => {
    await tapLobbyCard(s, actorId, hostUsername, true);
  },
});

export const joinFromPrompt = scenarioAction({
  name: 'joinFromPrompt',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitActiveSpace(s, actorId);
  },
});

export const expectActiveSpace = scenarioAction({
  name: 'expectActiveSpace',
  act: waitActiveSpace,
});

export const reenterActiveSpace = scenarioAction({
  name: 'reenterActiveSpace',
  act: reenterSpace,
});

export const endSpace = scenarioAction({
  name: 'endSpace',
  act: async (s, actorId: string) => {
    await tapChromeAction(s, actorId, Handles.spaceEnd);
    await confirmSpaceMutation(s, actorId, Handles.spaceEndConfirm);
    const ui = await actorUi(s, actorId);
    await ui.get(SCREEN_SPACE_ENDED).expect.visible({
      timeoutMs: SPACE_WAIT_MS,
    });
  },
});

export const expectLobbyCardGone = scenarioAction({
  name: 'expectLobbyCardGone',
  act: async (s, actorId: string, hostUsername: string) => {
    await showSpacesTab(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceCard(hostUsername)).expect.hidden({
      timeoutMs: SPACE_HIDDEN_MS,
    });
  },
});
