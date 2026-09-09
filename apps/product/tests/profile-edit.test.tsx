import { describe, expect, test } from 'bun:test';
import { Handles } from '@libs/test-ids';
import {
  avatarTraitVisible,
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
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
    expect(await s.read(readUsername, 'alice')).toBe('guest_user_1');
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
    expect(await s.read(readAvatarStyleLabel, 'alice')).toContain('Bottts');
    expect(await s.read(avatarTraitVisible, 'alice')).toBe(true);
    await s.apply(saveAvatar, 'alice');
    await s.apply(leaveAvatarEditor, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    expect(await s.read(readAvatarSeed, 'alice')).toBe('sim-seed-guest');
    expect(await s.read(readAvatarStyleLabel, 'alice')).toContain('Bottts');
  });

  test('signed-in updates username', async () => {
    await using s = await openSim('profile-edit-signed-username');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'signed_alice_1');
    expect(await s.read(readUsername, 'alice')).toBe('signed_alice_1');
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
    expect(await s.read(readAvatarStyleLabel, 'alice')).toContain('Bottts');
    expect(await s.read(avatarTraitVisible, 'alice')).toBe(true);
    await s.apply(saveAvatar, 'alice');
    await s.apply(leaveAvatarEditor, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    expect(await s.read(readAvatarSeed, 'alice')).toBe('sim-seed-signed');
    expect(await s.read(readAvatarStyleLabel, 'alice')).toContain('Bottts');
  });
});
