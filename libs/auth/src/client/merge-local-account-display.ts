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

function resolveUsername(
  rosterUsername: string | null,
  sessionUsername: string | null,
  useActiveProfile: boolean,
  activeProfileUsername: string | null
): string | null {
  // Active + bound: live SQLite wins over a possibly-stale roster cache.
  if (useActiveProfile) {
    const fromProfile = nonEmpty(activeProfileUsername);
    if (fromProfile !== null) return fromProfile;
  }
  const fromRoster = nonEmpty(rosterUsername);
  if (fromRoster !== null) return fromRoster;
  return nonEmpty(sessionUsername);
}

function resolveAvatarConfigJson(
  rosterAvatarConfigJson: string | null,
  useActiveProfile: boolean,
  activeProfileAvatarConfigJson: string | null
): string | null {
  if (useActiveProfile) {
    const fromProfile = nonEmpty(activeProfileAvatarConfigJson);
    if (fromProfile !== null) return fromProfile;
  }
  return nonEmpty(rosterAvatarConfigJson);
}

/**
 * Live profile is keyed by lastLocalAccountId. Only paint it onto a session
 * whose roster row already points at that account — otherwise a mid-switch
 * provider flip shows the previous account's username/avatar on the new session.
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
 * Active + bound: prefer SQLite profile; fall back to roster / session.
 * Inactive: roster display cache (last known while that identity was active),
 * then session username.
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
  return {
    username: resolveUsername(
      args.entry?.username ?? null,
      args.session.username,
      useProfile,
      args.activeProfile?.username ?? null
    ),
    avatarConfigJson: resolveAvatarConfigJson(
      args.entry?.avatarConfigJson ?? null,
      useProfile,
      args.activeProfile?.avatar_config ?? null
    ),
  };
}
