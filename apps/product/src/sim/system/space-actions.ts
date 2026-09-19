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

export const selectChessGame = scenarioAction({
  name: 'selectChessGame',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.gameMenuChess).expect.visible({
      timeoutMs: SPACE_WAIT_MS,
    });
    await ui.get(Handles.gameMenuChess).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui.get(Handles.chessMenuPuzzle).expect.visible({
      timeoutMs: SPACE_WAIT_MS,
    });
  },
});

export const openSpaceMembers = scenarioAction({
  name: 'openSpaceMembers',
  act: async (s, actorId: string) => {
    await tapChromeAction(s, actorId, Handles.spaceMembersButton);
    await s.session.waitForIdle();
  },
});

export const leaveSpace = scenarioAction({
  name: 'leaveSpace',
  act: async (s, actorId: string) => {
    await tapChromeAction(s, actorId, Handles.spaceLeave);
    await confirmSpaceMutation(s, actorId, Handles.spaceLeaveConfirm);
    const ui = await actorUi(s, actorId);
    // Dismiss the success state when present (optional step).
    if (await ui.get(Handles.spaceMutationDismiss).isVisible()) {
      await ui
        .get(Handles.spaceMutationDismiss)
        .tap({ timeoutMs: SPACE_WAIT_MS });
    }
  },
});
