/**
 * Resolves whether this account has the space open locally.
 * Role uses account id vs `host_member_id` / `host_account_id`.
 */
export type SpacePresence =
  | { readonly status: 'loading' }
  | { readonly status: 'active'; readonly role: 'host' | 'guest' }
  | { readonly status: 'join'; readonly ended: boolean };

type SpaceRow = {
  readonly host_member_id: string | null;
  readonly host_account_id?: string | null;
  readonly ended_at: string | null;
};

function nonEmptyEqual(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a === b;
}

/** Host role from space host fields. */
export function isViewerSpaceHost(
  spaceRow: SpaceRow | null | undefined,
  myId: string
): boolean {
  if (spaceRow === null || spaceRow === undefined) return false;
  // Treat missing/`undefined` like SQL NULL (some drivers omit unset columns).
  if (spaceRow.ended_at != null) return false;
  return (
    nonEmptyEqual(spaceRow.host_member_id ?? '', myId) ||
    nonEmptyEqual(spaceRow.host_account_id ?? '', myId)
  );
}

export function resolveSpacePresence(args: {
  readonly spaceEnabled: boolean;
  readonly spaceLoading: boolean;
  readonly spaceRow: SpaceRow | null;
  readonly isOpenLocally: boolean;
  readonly isMember: boolean;
  readonly myId: string;
}): SpacePresence {
  if (!args.spaceEnabled) {
    return { status: 'loading' };
  }
  const endedAt = args.spaceRow?.ended_at ?? null;
  if (endedAt != null) {
    return { status: 'join', ended: true };
  }
  if (args.spaceLoading && args.spaceRow === null) {
    return { status: 'loading' };
  }
  if (args.isOpenLocally && args.isMember) {
    return {
      status: 'active',
      role: isViewerSpaceHost(args.spaceRow, args.myId) ? 'host' : 'guest',
    };
  }
  return { status: 'join', ended: false };
}
