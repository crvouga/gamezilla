import {
  abandonSignIn,
  confirmAccountLink,
  keepSeparateAccount,
  returnToTabs,
  signInWithApple,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signInWithProviderAs,
  signOut,
} from './auth-actions';
import { AUTH_WALK_ACTIONS } from './auth-walk';
import {
  appleDeletesAccount,
  appleRevokesApp,
  seedProviderAccount,
} from './provider-events-actions';
import { focusActor, openSettings } from './shell-actions';
import {
  connectSignInMethod,
  removeSignInMethod,
  signOutEverywhere,
} from './sign-in-method-actions';

/**
 * Scenario actions every composition has: the shell, and auth — signing in
 * with either provider, linking decisions, the account's sign-in methods,
 * and the account holder acting at Apple.
 */
export const SHELL_SCENARIO_ACTIONS = [
  openSettings,
  focusActor,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signInWithApple,
  signInWithProviderAs,
  abandonSignIn,
  confirmAccountLink,
  keepSeparateAccount,
  connectSignInMethod,
  removeSignInMethod,
  signOutEverywhere,
  appleRevokesApp,
  appleDeletesAccount,
  seedProviderAccount,
  signOut,
  returnToTabs,
  ...AUTH_WALK_ACTIONS,
];
