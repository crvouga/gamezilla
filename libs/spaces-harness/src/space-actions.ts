import { actorUi, ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import { Handles } from '@libs/test-ids-shared/handles';
import {
  addPersonToSpace,
  openSpacePersonPicker,
} from './space-addition-actions';
import {
  cancelRenameSpace,
  startAllowingSpaceName,
  stopAllowingSpaceName,
} from './space-name-rule-actions';
import {
  closeSpaceShare,
  openSpaceShare,
  removePersonFromSpace,
} from './space-removal-actions';
import { returnToRetainedSpace } from './space-retained-actions';
import {
  confirmSpaceMutation,
  leaveToLobby,
  reenterOwnSpace,
  reenterSpace,
  SPACE_WAIT_MS,
  showSpacesTab,
  tapChromeAction,
  tapChromeOrOverflow,
  tapLobbyCard,
  waitActiveSpace,
  waitForOneOf,
  waitSpaceOutcome,
} from './space-ui';
import { localSpaceHostUsername } from './spaces-ui-reads';

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

/**
 * Press New space and wait for what it comes to: the new space, or the
 * Spaces screen saying why not (no connection, the hosting limit).
 */
export const startSpace = scenarioAction({
  name: 'startSpace',
  act: async (s, actorId: string) => {
    await showSpacesTab(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceCreate).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitForOneOf(
      s,
      actorId,
      [
        Handles.spaceClose,
        Handles.spacesNeedConnection,
        Handles.spacesHostingLimit,
      ],
      'a new space, or why not'
    );
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
    // A host opening their own live space is taken in, so Join never shows.
    if (await ui.get(Handles.spaceClose).isVisible()) {
      await waitActiveSpace(s, actorId);
      return;
    }
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitActiveSpace(s, actorId);
  },
});

/**
 * Join from a lobby card when offered, or let the space's refusal show.
 * Someone already seated goes straight in.
 */
export const joinFromLobby = scenarioAction({
  name: 'joinFromLobby',
  act: async (s, actorId: string, hostUsername: string) => {
    await tapLobbyCard(s, actorId, hostUsername, false);
    await s.session.waitForIdle();
    const ui = await actorUi(s, actorId);
    const outcome = await waitSpaceOutcome(
      s,
      actorId,
      `${hostUsername}'s space or why joining is unavailable`
    );
    if (outcome !== Handles.spaceJoin) return;
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitForOneOf(
      s,
      actorId,
      [Handles.spaceClose, Handles.spaceEnded, Handles.spacesNeedConnection],
      `joined ${hostUsername}'s space, or why not`
    );
  },
});

export const reenterActiveSpace = scenarioAction({
  name: 'reenterActiveSpace',
  act: reenterSpace,
});

/**
 * Back into the one space the actor is in, from wherever the app opened,
 * through its lobby card.
 */
export const returnToOwnSpace = scenarioAction({
  name: 'returnToOwnSpace',
  act: reenterOwnSpace,
});

/**
 * Back into the live space behind `link` from the actor's lobby card. The
 * card carries its host's username, which a guest host never chose, so it is
 * looked up from the actor's own copy of the space.
 */
export const reopenLiveSpace = scenarioAction({
  name: 'reopenLiveSpace',
  act: async (s, actorId: string, link: string) => {
    const host = await localSpaceHostUsername(s, actorId, link);
    if (host === null) throw new Error(`${actorId} has no copy of ${link}`);
    await reenterSpace(s, actorId, host);
  },
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
    const ui = await actorUi(s, actorId);
    if (await ui.get(Handles.spaceShareClose).isVisible())
      await Promise.resolve(closeSpaceShare.act(s, actorId));
    await tapChromeAction(s, actorId, Handles.spaceMembersButton);
    await s.session.waitForIdle();
  },
});

/**
 * Leave the space from its chrome (a host's Leave sits in the ⋯ menu, and
 * ends the space for everyone) and confirm.
 */
export const leaveSpace = scenarioAction({
  name: 'leaveSpace',
  act: async (s, actorId: string) => {
    await tapChromeOrOverflow(s, actorId, Handles.spaceLeave);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceLeaveConfirm).tap({ timeoutMs: SPACE_WAIT_MS });
    await ui
      .get(Handles.spaceLeaveConfirm)
      .expect.hidden({ timeoutMs: SPACE_WAIT_MS });
    // The success state stays up only while the screen that asked does.
    if (await ui.get(Handles.spaceMutationDismiss).isVisible()) {
      await ui
        .get(Handles.spaceMutationDismiss)
        .tap({ timeoutMs: SPACE_WAIT_MS });
    }
  },
});

/** The host renames the space from its chrome and saves. */
export const renameSpace = scenarioAction({
  name: 'renameSpace',
  act: async (s, actorId: string, title: string) => {
    await tapChromeOrOverflow(s, actorId, Handles.spaceRename);
    const ui = await actorUi(s, actorId);
    const input = ui.get(Handles.spaceRenameInput);
    await input.expect.visible({ timeoutMs: SPACE_WAIT_MS });
    await input.clear();
    await input.input(title);
    // A name that is not allowed is refused as it is typed: the dialog
    // stays open saying so, and nothing is saved.
    if (await ui.get(Handles.spaceRenameNotAllowed).isVisible()) return;
    await confirmSpaceMutation(s, actorId, Handles.spaceRenameConfirm);
  },
});

/**
 * Look through the space chrome for its less common actions: open its ⋯ menu
 * when it has one (a chrome whose actions all fit has none).
 */
export const openSpaceMenu = scenarioAction({
  name: 'openSpaceMenu',
  act: async (s, actorId: string) => {
    await waitActiveSpace(s, actorId);
    const ui = await actorUi(s, actorId);
    if (await ui.get(Handles.spaceChromeOverflow).isVisible()) {
      await ui
        .get(Handles.spaceChromeOverflow)
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
    await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
    await waitSpaceOutcome(s, actorId, `space link ${link} opened`);
  },
});

/**
 * Join a space from its link the way a person does: open it, press Join when
 * it is offered, and wait for what that comes to — the space, or a screen
 * saying it has ended, cannot be found, or needs a connection.
 */
export const joinViaLink = scenarioAction({
  name: 'joinViaLink',
  act: async (s, actorId: string, link: string) => {
    await Promise.resolve(openSpaceLink.act(s, actorId, link));
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.spaceJoin).isVisible())) return;
    await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitForOneOf(
      s,
      actorId,
      [Handles.spaceClose, Handles.spaceEnded, Handles.spacesNeedConnection],
      `joined from ${link}, or why not`
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

/** Registered on every system that composes this sub. */
export const SPACES_HARNESS_ACTIONS = [
  addPersonToSpace,
  openSpacePersonPicker,
  returnToRetainedSpace,
  closeSpaceShare,
  openSpaceShare,
  removePersonFromSpace,
  stopAllowingSpaceName,
  startAllowingSpaceName,
  cancelRenameSpace,
  startSpace,
  reopenLiveSpace,
  returnToOwnSpace,
  joinViaLink,
  renameSpace,
  openSpaceMenu,
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
