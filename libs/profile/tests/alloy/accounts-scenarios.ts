/**
 * Scripted worlds for the accounts structure: guests, people signing in with
 * Google or Apple on one or two devices, connecting and removing sign-in
 * methods, signing out (here or everywhere), Apple deleting an account, and
 * renaming — through the same harness actions the profile steps and the
 * account-sign-in Quint binding use.
 */

import {
  appleDeletesAccount,
  connectSignInMethod,
  focusActor,
  openAccount,
  removeSignInMethod,
  returnToTabs,
  signedOutShown,
  signInWithApple,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
  signOutEverywhere,
} from '@libs/harness';
import type { OpenHarness } from '@libs/harness/open-harness/open-harness';
import {
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  saveAvatar,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
} from '@libs/profile/harness/profile-actions';

import type { Scenario } from './snapshot-worlds';

/** Apple telling the API about a deleted account can take this long to show. */
const SIGNED_OUT_WAIT_MS = 150_000;

async function signIn(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(signInWithGoogle, actor);
  await s.apply(returnToTabs, actor);
}

/** `device` signs in with Google as `person` (their second device). */
async function signInOn(
  s: OpenHarness,
  device: string,
  person: string
): Promise<void> {
  await s.apply(signInWithGoogleAsAccount, device, person);
  await s.apply(returnToTabs, device);
}

async function rename(
  s: OpenHarness,
  actor: string,
  username: string
): Promise<void> {
  await s.apply(focusActor, actor);
  await s.apply(openProfileEdit, actor);
  await s.apply(setUsername, actor, username);
}

async function newAvatar(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(openProfileEdit, actor);
  await s.apply(openAvatarEditor, actor);
  await s.apply(setAvatarSeed, actor, 'sunflower');
  await s.apply(setAvatarStyle, actor, 'Bottts');
  await s.apply(saveAvatar, actor);
  await s.apply(leaveAvatarEditor, actor);
}

export const ACCOUNTS_SCENARIOS: readonly Scenario[] = [
  {
    name: 'Alice is signed in with Google on two devices, beside a guest',
    run: async (s) => {
      await s.apply(focusActor, 'guest');
      await signIn(s, 'alice');
      await signInOn(s, 'alice_phone', 'alice');
    },
  },
  {
    name: 'Alice signed in with Apple, connected Google, and signed out on her phone',
    run: async (s, capture) => {
      await s.apply(signInWithApple, 'alice');
      await s.apply(returnToTabs, 'alice');
      await s.apply(connectSignInMethod, 'alice', 'google');
      await signInOn(s, 'alice_phone', 'alice');
      await capture('with both devices signed in');
      await s.apply(openAccount, 'alice_phone');
      await s.apply(signOut, 'alice_phone');
    },
  },
  {
    name: 'Bob deleted his only Apple account at Apple',
    run: async (s, capture) => {
      await s.apply(signInWithApple, 'bob', { account: 'icloud' });
      await s.apply(returnToTabs, 'bob');
      await s.apply(appleDeletesAccount, 'bob', 'icloud');
      await capture('as Apple tells the app');
      await s.until((h) => signedOutShown(h, 'bob'), {
        pred: (signedOut) => signedOut,
        maxMs: SIGNED_OUT_WAIT_MS,
      });
    },
  },
  {
    name: 'Alice renamed herself and changed her avatar, and Bob took her old name',
    run: async (s) => {
      await signIn(s, 'alice');
      await signIn(s, 'bob');
      await rename(s, 'alice', 'alice_w');
      await newAvatar(s, 'alice');
      await rename(s, 'bob', 'alice');
    },
  },
  {
    name: 'Alice connected Apple, removed it again, and signed out everywhere',
    run: async (s, capture) => {
      await signIn(s, 'alice');
      await s.apply(connectSignInMethod, 'alice', 'apple');
      await s.apply(removeSignInMethod, 'alice', 'apple');
      await signInOn(s, 'alice_phone', 'alice');
      await capture('with Google alone on two devices');
      await s.apply(focusActor, 'alice_phone');
      await s.apply(signOutEverywhere, 'alice_phone');
    },
  },
];
