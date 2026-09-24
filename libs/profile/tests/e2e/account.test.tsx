// goal:social:2
// goal:social:3
import { describe, test } from 'bun:test';
import {
  leaveUsernameEditor,
  openProfileEdit,
  setUsername,
  submitUsername,
} from '@libs/profile/sim/profile-actions';
import { readProfileTabUsername } from '@libs/profile/sim/profile-ui-reads';
import {
  focusActor,
  openAccount,
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from '@libs/sim-harness';
import { openSim } from './support/open-profile-sim';

const SYNC_MS = 15_000;

describe('profile ↔ account', () => {
  test('signing out leaves the profile with the account; signing back in brings it back', async () => {
    await using s = await openSim('account-sign-out-in');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'alice_account');

    await s.apply(openAccount, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.until((surf) => readProfileTabUsername(surf, 'alice'), {
      pred: (name) => name !== null && name !== 'alice_account',
      maxMs: SYNC_MS,
    });

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.until((surf) => readProfileTabUsername(surf, 'alice'), {
      pred: (name) => name === 'alice_account',
      maxMs: SYNC_MS,
    });
  });

  test('the same account on a second device shows the same profile, and edits follow live', async () => {
    await using s = await openSim('account-two-devices');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(setUsername, 'alice', 'alice_laptop');

    await s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
    await s.apply(returnToTabs, 'alice_phone');
    await s.until((surf) => readProfileTabUsername(surf, 'alice_phone'), {
      pred: (name) => name === 'alice_laptop',
      maxMs: SYNC_MS,
    });

    await s.apply(openProfileEdit, 'alice_phone');
    await s.apply(submitUsername, 'alice_phone', 'alice_phone_1');
    await s.apply(leaveUsernameEditor, 'alice_phone');
    await s.apply(focusActor, 'alice');
    await s.until((surf) => readProfileTabUsername(surf, 'alice'), {
      pred: (name) => name === 'alice_phone_1',
      maxMs: SYNC_MS,
    });
  });
});
