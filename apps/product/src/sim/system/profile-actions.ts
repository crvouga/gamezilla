import { Handles } from '@libs/test-ids';

import { actorUi, pressBackUntilVisible, scenarioAction } from './actor-ui';

const WAIT_MS = 5_000;

export const openProfileEdit = scenarioAction({
  name: 'openProfileEdit',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabProfile).tap();
    await ui.get(Handles.profileEdit).tap();
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
    await pressBackUntilVisible(ui, Handles.profileEdit, WAIT_MS);
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

export const setAvatarStyle = scenarioAction({
  name: 'setAvatarStyle',
  act: async (
    s,
    actorId: string,
    styleSearch: string,
    styleOptionHandle: string
  ) => {
    const ui = await actorUi(s, actorId);
    await s.session.waitForIdle();
    await ui.get(Handles.profileAvatarStyle).tap();
    await ui.get(Handles.profileAvatarStyleSearch).input(styleSearch);
    await ui.get(styleOptionHandle).tap();
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
