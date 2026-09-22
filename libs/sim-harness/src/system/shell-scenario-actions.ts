import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from './auth-actions';
import { focusActor, openAccount, openSettings } from './shell-actions';

/** Scenario actions every composition has: the shell and sign-in. */
export const SHELL_SCENARIO_ACTIONS = [
  openSettings,
  openAccount,
  focusActor,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
  returnToTabs,
];
