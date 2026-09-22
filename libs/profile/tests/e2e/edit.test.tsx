import { describe, expect, test } from 'bun:test';
import {
  cancelAvatarEdits,
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  saveAvatar,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
} from '@libs/profile/sim/profile-actions';
import {
  avatarTraitVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
} from '@libs/profile/sim/profile-ui-reads';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-profile-sim';

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

  test('avatar edits left with Cancel are not saved', async () => {
    await using s = await openSim('profile-edit-avatar-cancel');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(setAvatarSeed, 'alice', 'kept-seed');
    await s.apply(saveAvatar, 'alice');
    await s.apply(setAvatarSeed, 'alice', 'discarded-seed');
    // Cancel asks first; keeping on editing keeps the draft.
    await s.apply(cancelAvatarEdits, 'alice', false);
    expect(await s.read(readAvatarSeed, 'alice')).toBe('discarded-seed');
    await s.apply(cancelAvatarEdits, 'alice', true);
    await s.apply(openAvatarEditor, 'alice');
    expect(await s.read(readAvatarSeed, 'alice')).toBe('kept-seed');
  });

  test('signed-in updates username', async () => {
    await using s = await openSim('profile-edit-signed-username');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'signed_alice_1');
    expect(await s.read(readUsername, 'alice')).toBe('signed_alice_1');
  });

  test('signed-in updates avatar', async () => {
    await using s = await openSim('profile-edit-signed-avatar');
    await s.apply(signInWithGoogle, 'alice');
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
