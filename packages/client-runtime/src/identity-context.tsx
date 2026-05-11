/**
 * Identity context exposed by `client-runtime` so feature packages (profile,
 * spaces, chess, …) can read the current `myId` / `deviceId` / `accountId`
 * without importing from `@gamezilla/auth`. The auth feature is the sole
 * provider of this context at the composition root.
 *
 * Keeping this seam in a leaf package preserves the layering rule that no
 * feature package may depend on another feature package.
 */
import { createContext, useContext, type ReactNode } from 'react';

export type IdentityState = {
  /** Install-scoped device id (always present once auth bootstraps). */
  deviceId: string;
  /** Internal account id when signed in, else `null`. */
  accountId: string | null;
  /**
   * `accountId` when signed in, else `deviceId`. Used by the rest of the app
   * as the "current user" id (patch-db rows, room membership, …).
   */
  myId: string;
};

const FALLBACK_IDENTITY: IdentityState = {
  deviceId: '',
  accountId: null,
  myId: '',
};

const IdentityContext = createContext<IdentityState | null>(null);

export function IdentityProvider({
  value,
  children,
}: {
  value: IdentityState;
  children: ReactNode;
}): ReactNode {
  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

/**
 * Identity state for the current session. Returns a zero-value fallback when
 * called outside an `IdentityProvider` so leaf utilities and storybooks render
 * safely.
 */
export function useIdentity(): IdentityState {
  return useContext(IdentityContext) ?? FALLBACK_IDENTITY;
}

/** Convenience hook: `accountId` when signed in, else `deviceId`. */
export function useMyId(): string {
  return useIdentity().myId;
}

/** Install-scoped device id; empty string before auth bootstraps. */
export function useMyDeviceId(): string {
  return useIdentity().deviceId;
}

/** Account id when signed in, else `null`. */
export function useMyAccountId(): string | null {
  return useIdentity().accountId;
}
