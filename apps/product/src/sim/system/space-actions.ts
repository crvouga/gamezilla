import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';
import {
  confirmSpaceMutation,
  leaveToLobby,
  reenterSpace,
  SPACE_WAIT_MS,
  showSpacesTab,
  tapChromeAction,
  tapLobbyCard,
  waitActiveSpace,
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
    await ui.get(Handles.spaceEnded).expect.visible({
      timeoutMs: SPACE_WAIT_MS,
    });
  },
});
