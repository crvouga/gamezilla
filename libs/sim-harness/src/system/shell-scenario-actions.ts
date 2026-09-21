import { returnToTabs, signInWithGoogle, signOut } from './auth-actions';
import { focusActor, openSettings } from './shell-actions';

/** Scenario actions every composition has: the shell and sign-in. */
export const SHELL_SCENARIO_ACTIONS = [
  openSettings,
  focusActor,
  signInWithGoogle,
  signOut,
  returnToTabs,
];
