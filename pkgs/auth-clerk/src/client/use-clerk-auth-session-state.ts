import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';
import { useAuth, useUser } from '@clerk/expo';

function mapClerkUserToSession(
  userId: string,
  email: string | null
): VerifiedSession {
  return {
    externalUserId: userId,
    accountId: null,
    email,
    expiresAt: null,
  };
}

export function useClerkAuthSessionState(): AuthSessionState {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return { session: null, isHydrated: false, error: null };
  }

  if (!isSignedIn || userId === null || userId === undefined) {
    return { session: null, isHydrated: true, error: null };
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const session = mapClerkUserToSession(userId, email);

  return { session, isHydrated: true, error: null };
}
