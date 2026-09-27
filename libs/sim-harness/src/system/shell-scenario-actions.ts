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
import {
  appleDeletesAccount,
  appleRevokesApp,
  seedProviderAccount,
} from './provider-events-actions';
import { focusActor, openAccount, openSettings } from './shell-actions';
import {
  awaitSignedOutScreen,
  connectSignInMethod,
  removeSignInMethod,
  showAccountScreen,
  signOutEverywhere,
  tryRemoveSignInMethod,
} from './sign-in-method-actions';

/**
 * Scenario actions every composition has: the shell, and auth — signing in
 * with either provider, linking decisions, the account's sign-in methods,
 * and the account holder acting at Apple.
 */
export const SHELL_SCENARIO_ACTIONS = [
  openSettings,
  openAccount,
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
  tryRemoveSignInMethod,
  signOutEverywhere,
  showAccountScreen,
  awaitSignedOutScreen,
  appleRevokesApp,
  appleDeletesAccount,
  seedProviderAccount,
  signOut,
  returnToTabs,
];
