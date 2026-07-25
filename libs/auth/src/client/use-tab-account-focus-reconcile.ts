import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { AccountSession } from '@pkgs/auth/client/account-session';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  findRosterEntryForSession,
} from './local-account-roster';
import type { LocalAccountRoster } from './local-account-roster-types';

function resolveAccountIdForSession(
  roster: LocalAccountRoster,
  session: AccountSession
): string | null {
  const entry = findRosterEntryForSession(roster, {
    sessionId: session.sessionId,
    externalUserId: session.externalUserId,
  });
  return entry?.accountId ?? null;
}

function findSessionIdForTabAccount(args: {
  readonly roster: LocalAccountRoster;
  readonly sessions: readonly AccountSession[];
  readonly tabAccountId: string;
}): string | null {
  const byRoster = args.roster.find(
    (row) =>
      row.accountId === args.tabAccountId &&
      !row.sessionId.startsWith('detached:')
  );
  if (byRoster !== undefined) {
    const stillLive = args.sessions.some(
      (session) => session.sessionId === byRoster.sessionId
    );
    if (stillLive) return byRoster.sessionId;
  }
  for (const session of args.sessions) {
    const accountId = resolveAccountIdForSession(args.roster, session);
    if (accountId === args.tabAccountId) return session.sessionId;
  }
  return null;
}

/**
 * Web: Clerk's active session is shared across tabs, but each tab keeps its
 * own `lastLocalAccountId` in sessionStorage. On focus, switch Clerk back to
 * the session that matches this tab's selected account.
 */
export function useTabAccountFocusReconcile(args: {
  readonly enabled: boolean;
  readonly tabAccountId: string | null;
  readonly sessions: readonly AccountSession[];
  readonly roster: LocalAccountRoster;
  readonly port: AuthClientPort;
}): void {
  const { enabled, tabAccountId, sessions, roster, port } = args;
  const inFlightRef = useRef(false);
  const sessionsRef = useRef(sessions);
  const rosterRef = useRef(roster);
  const tabAccountIdRef = useRef(tabAccountId);
  sessionsRef.current = sessions;
  rosterRef.current = roster;
  tabAccountIdRef.current = tabAccountId;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const reconcile = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const tabId = tabAccountIdRef.current;
      if (tabId === null || tabId.length === 0) return;
      if (inFlightRef.current) return;

      const liveSessions = sessionsRef.current;
      const liveRoster = rosterRef.current;
      const active = liveSessions.find((session) => session.isActive);
      if (active === undefined) return;

      const activeAccountId = resolveAccountIdForSession(liveRoster, active);
      if (activeAccountId === tabId) return;

      const targetSessionId = findSessionIdForTabAccount({
        roster: liveRoster,
        sessions: liveSessions,
        tabAccountId: tabId,
      });
      if (targetSessionId === null || targetSessionId === active.sessionId) {
        return;
      }

      inFlightRef.current = true;
      void port
        .switchAccount(targetSessionId)
        .catch(() => undefined)
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const onFocus = (): void => {
      reconcile();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') reconcile();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    reconcile();
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, port]);
}
