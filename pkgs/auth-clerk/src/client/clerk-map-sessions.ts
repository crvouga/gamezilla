import type { ClerkRuntimeSession } from './clerk-auth-runtime';

type ClerkSessionLike = {
  readonly id: string;
  readonly user?: {
    readonly id?: string;
    readonly username?: string | null;
    readonly primaryEmailAddress?: { readonly emailAddress?: string } | null;
  } | null;
  readonly publicUserData?: {
    readonly userId?: string;
    readonly identifier?: string;
    readonly username?: string | null;
  };
};

function readSessionUserId(session: ClerkSessionLike): string | null {
  const fromUser = session.user?.id;
  if (typeof fromUser === 'string' && fromUser.length > 0) return fromUser;
  const fromPublic = session.publicUserData?.userId;
  if (typeof fromPublic === 'string' && fromPublic.length > 0)
    return fromPublic;
  return null;
}

function readSessionEmail(session: ClerkSessionLike): string | null {
  const fromUser = session.user?.primaryEmailAddress?.emailAddress;
  if (typeof fromUser === 'string' && fromUser.length > 0) return fromUser;
  const identifier = session.publicUserData?.identifier;
  if (typeof identifier === 'string' && identifier.includes('@')) {
    return identifier;
  }
  return null;
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) return null;
  return value;
}

/**
 * Display username from Clerk when the app roster has not synced yet.
 * Prefers `publicUserData.username`, then `user.username`, then a non-email
 * `identifier`.
 */
function readSessionUsername(session: ClerkSessionLike): string | null {
  const fromPublic = nonEmpty(session.publicUserData?.username);
  if (fromPublic !== null) return fromPublic;
  const fromUser = nonEmpty(session.user?.username);
  if (fromUser !== null) return fromUser;
  const identifier = nonEmpty(session.publicUserData?.identifier);
  if (identifier !== null && !identifier.includes('@')) return identifier;
  return null;
}

export function mapClerkSessions(
  sessions: readonly ClerkSessionLike[] | undefined | null
): readonly ClerkRuntimeSession[] {
  if (sessions === null || sessions === undefined) return [];
  return sessions.map((session) => ({
    id: session.id,
    userId: readSessionUserId(session),
    email: readSessionEmail(session),
    username: readSessionUsername(session),
  }));
}
