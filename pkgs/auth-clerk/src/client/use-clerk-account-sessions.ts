import type { AccountSession } from '@pkgs/auth/client/account-session';
import { useAuth, useSessionList } from '@clerk/expo';

import { mapClerkSessions } from './clerk-map-sessions';

/**
 * Maps Clerk's client session list into the auth-port {@link AccountSession} shape.
 */
export function useClerkAccountSessions(): readonly AccountSession[] {
  const { sessionId } = useAuth();
  const { sessions, isLoaded } = useSessionList();

  if (!isLoaded || sessions === undefined) return [];

  return mapClerkSessions(sessions).flatMap((session) => {
    if (session.userId === null) return [];
    return [
      {
        sessionId: session.id,
        externalUserId: session.userId,
        email: session.email,
        username: session.username,
        isActive: session.id === sessionId,
      } satisfies AccountSession,
    ];
  });
}
