import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { StyleKey } from '@libs/profile-shared/dicebear-styles';
import { STYLE_KEYS, styleLabel } from '@libs/profile-shared/dicebear-styles';
import { Handles } from '@libs/test-ids-shared/handles';
import {
  startAllowingUsername,
  stopAllowingUsername,
} from './team-rule-actions';

type ActorUi = Awaited<ReturnType<typeof actorUi>>;

export const NAV_WAIT_MS = 2_000;
/** Screens deep a profile or account stack goes before the Profile tab. */
const MAX_BACK_STEPS = 4;

/**
 * Back out to the Profile tab from wherever the actor is: the username or
 * avatar editor, Edit profile, the account screen, or another tab. Leaves
 * unsaved drafts unsaved.
 */
export async function backToProfileTab(ui: ActorUi): Promise<void> {
  // Bring the actor's app to the front: a parked app shows nothing.
  await ui.get(Handles.statusCurrentUser).expect.visible();
  for (let step = 0; step < MAX_BACK_STEPS; step += 1) {
    if (await ui.get(Handles.profileEdit).isVisible()) return;
    if (await ui.get(Handles.profileUsernameCancel).isVisible()) {
      await ui
        .get(Handles.profileUsernameCancel)
        .tap({ timeoutMs: NAV_WAIT_MS });
    } else if (await ui.get(Handles.tabProfile).isVisible()) {
      await ui.get(Handles.tabProfile).tap({ timeoutMs: NAV_WAIT_MS });
    } else if (await ui.get(Handles.navBack).isVisible()) {
      await ui.get(Handles.navBack).tap({ timeoutMs: NAV_WAIT_MS });
    } else if (await ui.get(Handles.spaceClose).isVisible()) {
      await ui.get(Handles.spaceClose).tap({ timeoutMs: NAV_WAIT_MS });
    } else {
      // Nothing to back out of yet: wait for the tabs, as a person would.
      await ui.get(Handles.tabProfile).tap();
    }
  }
  await ui.get(Handles.profileEdit).expect.visible();
}

/** Open Edit profile from wherever the actor is (a no-op when it is open). */
export const openProfileEdit = scenarioAction({
  name: 'openProfileEdit',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.profileEditUsername).isVisible())) {
      await backToProfileTab(ui);
      await ui.get(Handles.profileEdit).tap();
    }
    await ui.get(Handles.profileEditUsername).expect.visible();
    await ui.get(Handles.profileEditAvatar).expect.visible();
  },
});

export const setUsername = scenarioAction({
  name: 'setUsername',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await s.session.waitForIdle();
    await ui.get(Handles.profileEditUsername).tap();
    const input = ui.get(Handles.profileUsernameInput);
    await input.expect.visible();
    await input.clear();
    await input.input(username);
    await ui.get(Handles.profileUsernameSave).tap();
    await ui.get(Handles.profileUsernameSave).expect.text('Saved');
    await ui.get(Handles.profileUsernameCancel).tap();
    await ui.get(Handles.profileEditUsername).expect.visible();
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.profileEdit).expect.visible();
  },
});

export const openAvatarEditor = scenarioAction({
  name: 'openAvatarEditor',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.profileEditAvatar).tap();
    await ui.get(Handles.profileAvatarSeed).expect.visible();
    await ui.get(Handles.profileAvatarStyle).expect.visible();
  },
});

export const setAvatarSeed = scenarioAction({
  name: 'setAvatarSeed',
  act: async (s, actorId: string, seed: string) => {
    const ui = await actorUi(s, actorId);
    const input = ui.get(Handles.profileAvatarSeed);
    await input.expect.visible();
    await input.clear();
    await input.input(seed);
  },
});

/** The style key whose picker label is `label` (e.g. "Bottts" → `bottts`). */
function styleKeyForLabel(label: string): StyleKey {
  const key = STYLE_KEYS.find((candidate) => styleLabel(candidate) === label);
  if (key === undefined)
    throw new Error(`no avatar style is labelled "${label}"`);
  return key;
}

/** Pick the avatar style labelled `label`, searching for it by name. */
export const setAvatarStyle = scenarioAction({
  name: 'setAvatarStyle',
  act: async (s, actorId: string, label: string) => {
    const ui = await actorUi(s, actorId);
    await s.session.waitForIdle();
    await ui.get(Handles.profileAvatarStyle).tap();
    await ui.get(Handles.profileAvatarStyleSearch).input(label);
    await ui
      .get(Handles.profileAvatarStyleOption(styleKeyForLabel(label)))
      .tap();
    await ui.get(Handles.profileAvatarStyle).expect.visible();
  },
});

export const saveAvatar = scenarioAction({
  name: 'saveAvatar',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.profileAvatarSave).tap();
    await ui.get(Handles.profileAvatarSave).expect.text('Saved');
  },
});

export const leaveAvatarEditor = scenarioAction({
  name: 'leaveAvatarEditor',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.profileAvatarCancel).tap();
    await ui.get(Handles.profileEditAvatar).expect.visible();
  },
});

/**
 * Cancel out of an edited avatar: the editor asks first; `discard` answers
 * Discard (back to Edit profile) or keep editing (the draft stays).
 */
export const cancelAvatarEdits = scenarioAction({
  name: 'cancelAvatarEdits',
  act: async (s, actorId: string, discard: boolean) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.profileAvatarCancel).tap();
    if (!discard) {
      await ui.get(Handles.profileAvatarDiscardKeep).tap();
      await ui.get(Handles.profileAvatarDiscardKeep).expect.hidden();
      await ui.get(Handles.profileAvatarSeed).expect.visible();
      return;
    }
    await ui.get(Handles.profileAvatarDiscardConfirm).tap();
    await ui.get(Handles.profileEditAvatar).expect.visible();
  },
});

const SAVE_WAIT_MS = 10_000;
/** Faces the username save button shows before the server has answered. */
const UNSETTLED_SAVE_FACES = ['Save', 'Saving…'];

/**
 * Type `username` into the username screen and press Save, then wait until
 * the button settles on the answer (`Saved` or the reason it was refused).
 * Stays on the screen so the face can be read (`readUsernameSaveFace`).
 */
export const submitUsername = scenarioAction({
  name: 'submitUsername',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await s.session.waitForIdle();
    if (!(await ui.get(Handles.profileUsernameInput).isVisible())) {
      await ui.get(Handles.profileEditUsername).tap();
    }
    const input = ui.get(Handles.profileUsernameInput);
    await input.expect.visible();
    await input.clear();
    await input.input(username);
    await ui.get(Handles.profileUsernameSave).tap();
    await pollUntil(
      s,
      async () => {
        const face = (await ui.get(Handles.profileUsernameSave).text()) ?? '';
        return UNSETTLED_SAVE_FACES.includes(face.trim()) ? null : face;
      },
      { maxMs: SAVE_WAIT_MS, description: 'username save settled' }
    );
  },
});

/** Type a draft into the username field without saving it. */
export const typeUsernameDraft = scenarioAction({
  name: 'typeUsernameDraft',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await s.session.waitForIdle();
    await ui.get(Handles.profileEditUsername).tap();
    const input = ui.get(Handles.profileUsernameInput);
    await input.expect.visible();
    await input.clear();
    await input.input(username);
  },
});

/** Cancel out of the username screen, then back out of Edit profile. */
export const leaveUsernameEditor = scenarioAction({
  name: 'leaveUsernameEditor',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.profileUsernameCancel).tap();
    await ui.get(Handles.profileEditUsername).expect.visible();
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.profileEdit).expect.visible();
  },
});

/** Registered on every system that composes this sub. */
export const PROFILE_HARNESS_ACTIONS = [
  openProfileEdit,
  setUsername,
  submitUsername,
  typeUsernameDraft,
  cancelAvatarEdits,
  leaveUsernameEditor,
  openAvatarEditor,
  setAvatarSeed,
  setAvatarStyle,
  saveAvatar,
  leaveAvatarEditor,
  stopAllowingUsername,
  startAllowingUsername,
];
