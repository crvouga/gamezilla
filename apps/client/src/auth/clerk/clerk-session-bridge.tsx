import { useAuth } from '@clerk/clerk-expo';
import { getDefaultStore } from 'jotai';
import { useEffect, useRef } from 'react';
import { runClerkSessionSync } from './run-clerk-session-sync';

/**
 * Pushes Clerk session JWT into {@link sessionTokenAtom} / secure storage and
 * resolves internal `accountId` via `GET /auth/whoami`. Clears local session
 * state when Clerk signs out (including remote session revocation).
 */
export function ClerkSessionBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const store = getDefaultStore();
    void runClerkSessionSync({
      store,
      isSignedIn,
      getToken,
      lastSyncedRef,
    });
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
