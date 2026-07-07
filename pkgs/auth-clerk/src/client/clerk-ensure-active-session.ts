import type { useAuth, useSessionList } from '@clerk/expo';

export type ClerkSetActive = (params: { session: string }) => Promise<void>;

type EnsureActiveSessionArgs = {
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean | undefined;
  readonly sessionId: ReturnType<typeof useAuth>['sessionId'];
  readonly sessionsLoaded: boolean;
  readonly sessions: ReturnType<typeof useSessionList>['sessions'];
  readonly getToken: ReturnType<typeof useAuth>['getToken'];
  readonly setActive: ClerkSetActive;
};

function resolveInactiveSessionId(args: {
  sessionId: string | null | undefined;
  sessions: EnsureActiveSessionArgs['sessions'];
}): string | null {
  if (
    args.sessionId !== null &&
    args.sessionId !== undefined &&
    args.sessionId.length > 0
  ) {
    return args.sessionId;
  }

  const sessions = args.sessions ?? [];
  const lastSession = sessions[sessions.length - 1];
  return lastSession?.id ?? null;
}

export async function ensureClerkActiveSession(
  args: EnsureActiveSessionArgs
): Promise<void> {
  if (!args.isLoaded || !args.sessionsLoaded) return;
  if (args.isSignedIn === true) return;

  const existingToken = await args.getToken();
  if (existingToken !== null) return;

  const targetSessionId = resolveInactiveSessionId({
    sessionId: args.sessionId,
    sessions: args.sessions,
  });
  if (targetSessionId === null) return;

  await args.setActive({ session: targetSessionId });
}
