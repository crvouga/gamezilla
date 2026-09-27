import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/sim-harness/system/actor-ui';
import { Handles } from '@libs/test-ids';
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

/**
 * Into a live space from its lobby card: through the join prompt the first
 * time, straight in for someone already seated.
 */
export const joinFromLobby = scenarioAction({
  name: 'joinFromLobby',
  act: async (s, actorId: string, hostUsername: string) => {
    await tapLobbyCard(s, actorId, hostUsername, false);
    const ui = await actorUi(s, actorId);
    await pollUntil(
      s,
      async () =>
        (await ui.get(Handles.spaceJoin).isVisible()) ||
        (await ui.get(Handles.spaceClose).isVisible())
          ? true
          : null,
      {
        maxMs: SPACE_WAIT_MS,
        description: `${hostUsername}'s space or its join prompt`,
      }
    );
    if (await ui.get(Handles.spaceJoin).isVisible()) {
      await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
    }
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

/**
 * Open a space's link (`/space/<id>`, what the host's Copy link hands out)
 * the way a person pastes one: an app that may never have been opened, a
 * guest with no account. Lands on the join prompt, or in the space for
 * someone already seated.
 */
export const openSpaceLink = scenarioAction({
  name: 'openSpaceLink',
  act: async (s, actorId: string, link: string) => {
    await ensureActor(s, actorId);
    const actor = s.actors.get(actorId);
    if (actor === undefined) throw new Error(`actor ${actorId} missing`);
    await actor.openLink(link);
    const ui = await actorUi(s, actorId);
    // Bring the actor to the front: a parked actor's screen reads as empty,
    // and nothing carries this id, so the wait returns at once.
    await ui.get('sim-focus-probe').expect.hidden({ timeoutMs: 1 });
    await pollUntil(
      s,
      async () =>
        (await ui.get(Handles.spaceJoin).isVisible()) ||
        (await ui.get(Handles.spaceClose).isVisible())
          ? true
          : null,
      { maxMs: SPACE_WAIT_MS, description: `space link ${link} opened` }
    );
  },
});

export const closeSpaceMembers = scenarioAction({
  name: 'closeSpaceMembers',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceMembersClose).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui
      .get(Handles.spaceMembersClose)
      .expect.hidden({ timeoutMs: SPACE_WAIT_MS });
  },
});

/** Step out of the space screen (the ✕), staying a member. */
export const closeSpaceScreen = scenarioAction({
  name: 'closeSpaceScreen',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceClose).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui
      .get(Handles.spaceClose)
      .expect.hidden({ timeoutMs: SPACE_WAIT_MS });
  },
});

/**
 * Open a space link after the app restarted: someone already seated may land
 * straight in the space, or on the join prompt — either way they end up in it.
 */
export const reopenSpaceLink = scenarioAction({
  name: 'reopenSpaceLink',
  act: async (s, actorId: string, link: string) => {
    await Promise.resolve(openSpaceLink.act(s, actorId, link));
    const ui = await actorUi(s, actorId);
    if (await ui.get(Handles.spaceJoin).isVisible()) {
      await Promise.resolve(joinFromPrompt.act(s, actorId));
    }
    await waitActiveSpace(s, actorId);
  },
});

/** Registered on every system that composes this feature. */
export const SPACES_SIM_ACTIONS = [
  closeSpaceScreen,
  reopenSpaceLink,
  openSpacesTab,
  createSpace,
  returnToLobby,
  openLobbyCard,
  joinFromPrompt,
  joinFromLobby,
  reenterActiveSpace,
  endSpace,
  selectChessGame,
  openSpaceMembers,
  closeSpaceMembers,
  leaveSpace,
  openSpaceLink,
];
