// goal:social:2
// goal:always-true:10
import { describe, expect, test } from 'bun:test';

import {
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  saveAvatar,
  setAvatarSeed,
  setUsername,
} from '@libs/profile/sim/profile-actions';
import {
  readAvatarSeed,
  readUsername,
} from '@libs/profile/sim/profile-ui-reads';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-profile-sim';

describe('guest progress carryover', () => {
  test('a guest signs in with Google and keeps the name and avatar they made', async () => {
    await using s = await openSim('guest-carryover');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'guest_keeps_1');
    expect(await s.read(readUsername, 'alice')).toBe('guest_keeps_1');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    await s.apply(setAvatarSeed, 'alice', 'carried-seed');
    await s.apply(saveAvatar, 'alice');
    await s.apply(leaveAvatarEditor, 'alice');
    await s.apply(returnToTabs, 'alice');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');

    // Signed in now — and nothing the guest did was lost or replaced.
    await s.until(
      async (surf) => {
        const ui = surf.actors.get('alice')?.ui;
        if (ui === undefined) return false;
        await ui.get(Handles.tabProfile).tap();
        return (await readUsername(surf, 'alice')) === 'guest_keeps_1';
      },
      { maxMs: 15_000 }
    );
    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    expect(await s.read(readAvatarSeed, 'alice')).toBe('carried-seed');
  });
});
