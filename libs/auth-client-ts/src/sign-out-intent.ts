/**
 * The person is signing out from this device. {@link AuthBridge} then knows
 * the sign-out that follows was asked for here, and says nothing about it.
 * Without a bridge (isolated screen tests) both calls do nothing.
 */

import { createContext, useContext } from 'solid-js';

export type SignOutIntent = {
  /** Call just before asking the provider to sign out. */
  readonly expect: () => void;
  /** Call when that sign-out failed, so a later one is news again. */
  readonly cancel: () => void;
};

const NO_BRIDGE: SignOutIntent = {
  expect: () => undefined,
  cancel: () => undefined,
};

export const SignOutIntentContext = createContext<SignOutIntent>(NO_BRIDGE);

/** The intent backed by the bridge's own flag. */
export function signOutIntentOf(ref: { current: boolean }): SignOutIntent {
  return {
    expect: () => {
      ref.current = true;
    },
    cancel: () => {
      ref.current = false;
    },
  };
}

export function useSignOutIntent(): SignOutIntent {
  return useContext(SignOutIntentContext);
}
