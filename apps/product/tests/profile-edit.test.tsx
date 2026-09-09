import { describe, test } from 'bun:test';
import { Handles } from '@libs/test-ids';
import {
  expectAvatarSeed,
  expectAvatarStyleLabel,
  expectAvatarTraitVisible,
  expectUsername,
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  returnToTabs,
  saveAvatar,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
  signInWithDev,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('profile edit', () => {
  test('guest updates username', async () => {
    await using s = await openSim('profile-edit-guest-username');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'guest_user_1');
    await s.apply(expectUsername, 'alice', 'guest_user_1');
  });

  test('guest updates avatar', async () => {
    await using s = await openSim('profile-edit-guest-avatar');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(setAvatarSeed, 'alice', 'sim-seed-guest');
    await s.apply(
      setAvatarStyle,
      'alice',
      'Bottts',
      Handles.profileAvatarStyleBottts
    );
    await s.apply(expectAvatarStyleLabel, 'alice', 'Bottts');
    await s.apply(expectAvatarTraitVisible, 'alice');
    await s.apply(saveAvatar, 'alice');
    await s.apply(leaveAvatarEditor, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(expectAvatarSeed, 'alice', 'sim-seed-guest');
    await s.apply(expectAvatarStyleLabel, 'alice', 'Bottts');
  });

  test('signed-in updates username', async () => {
    await using s = await openSim('profile-edit-signed-username');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'signed_alice_1');
    await s.apply(expectUsername, 'alice', 'signed_alice_1');
  });

  test('signed-in updates avatar', async () => {
    await using s = await openSim('profile-edit-signed-avatar');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(setAvatarSeed, 'alice', 'sim-seed-signed');
    await s.apply(
      setAvatarStyle,
      'alice',
      'Bottts',
      Handles.profileAvatarStyleBottts
    );
    await s.apply(expectAvatarStyleLabel, 'alice', 'Bottts');
    await s.apply(expectAvatarTraitVisible, 'alice');
    await s.apply(saveAvatar, 'alice');
    await s.apply(leaveAvatarEditor, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(expectAvatarSeed, 'alice', 'sim-seed-signed');
    await s.apply(expectAvatarStyleLabel, 'alice', 'Bottts');
  });
});
