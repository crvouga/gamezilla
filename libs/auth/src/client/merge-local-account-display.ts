import type { AccountSession } from '@pkgs/auth/client/account-session';

import type { LocalAccountRosterEntry } from './local-account-roster-types';

export type LocalAccountDisplay = {
  readonly username: string | null;
  readonly avatarConfigJson: string | null;
};

export type ActiveProfileDisplayRow = {
  readonly username: string | null;
  readonly avatar_config: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) return null;
  return value;
}

/**
 * Live profile is keyed by lastLocalAccountId. Only paint it onto a session
 * whose roster row already points at that account — otherwise a mid-switch
 * Clerk flip shows the previous account's username/avatar on the new session.
 */
export function shouldUseActiveProfile(
  entry: LocalAccountRosterEntry | undefined,
  isActive: boolean,
  activeAccountId: string | null
): boolean {
  if (!isActive || activeAccountId === null) return false;
  return entry?.accountId === activeAccountId;
}

/**
 * Active + bound: prefer SQLite profile; fall back to Clerk username when the
 * local row is missing/empty (warm switch hydrate). Inactive: Clerk username
 * only; avatar always null (no roster display cache).
 */
export function mergeLocalAccountDisplay(args: {
  readonly session: AccountSession;
  readonly entry: LocalAccountRosterEntry | undefined;
  readonly activeAccountId: string | null;
  readonly activeProfile: ActiveProfileDisplayRow | null;
}): LocalAccountDisplay {
  const useProfile = shouldUseActiveProfile(
    args.entry,
    args.session.isActive,
    args.activeAccountId
  );
  if (useProfile) {
    return {
      username:
        nonEmpty(args.activeProfile?.username) ??
        nonEmpty(args.session.username),
      avatarConfigJson: nonEmpty(args.activeProfile?.avatar_config),
    };
  }
  return {
    username: nonEmpty(args.session.username),
    avatarConfigJson: null,
  };
}
