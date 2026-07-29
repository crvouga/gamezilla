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

type PresenceLatch = { spaceId: string; presence: SpacePresence };

function nonEmptyEqual(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a === b;
}

/** Host role from space host fields. */
export function isViewerSpaceHost(
  spaceRow: SpaceRow | null | undefined,
  myId: string
): boolean {
  if (spaceRow === null || spaceRow === undefined) return false;
  if (spaceRow.ended_at !== null) return false;
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
  readonly myId: string;
}): SpacePresence {
  if (!args.spaceEnabled) {
    return { status: 'loading' };
  }
  const endedAt = args.spaceRow?.ended_at ?? null;
  if (endedAt !== null) {
    return { status: 'join', ended: true };
  }
  if (args.spaceLoading && args.spaceRow === null) {
    return { status: 'loading' };
  }
  if (args.isOpenLocally) {
    return {
      status: 'active',
      role: isViewerSpaceHost(args.spaceRow, args.myId) ? 'host' : 'guest',
    };
  }
  return { status: 'join', ended: false };
}

function latchForSpace(
  spaceId: string,
  latch: PresenceLatch | null
): PresenceLatch | null {
  if (latch === null || latch.spaceId !== spaceId) return null;
  return latch;
}

function holdActiveAcrossTransientJoin(
  spaceId: string,
  resolved: SpacePresence,
  latch: PresenceLatch | null
): PresenceLatch | null {
  if (resolved.status !== 'join' || resolved.ended) return null;
  if (latch === null || latch.presence.status !== 'active') return null;
  return latchForSpace(spaceId, latch);
}

/**
 * Hold the last non-loading presence while queries report `loading`, and hold
 * `active` across transient `join` snapshots. Ended spaces always accept
 * `join`. Intentional leave/end must clear the shared latch store.
 */
export function latchStaleSpacePresence(
  spaceId: string,
  resolved: SpacePresence,
  latch: PresenceLatch | null
): { presence: SpacePresence; latch: PresenceLatch | null } {
  if (spaceId.length === 0) {
    return { presence: resolved, latch: null };
  }
  const scoped = latchForSpace(spaceId, latch);
  const heldActive = holdActiveAcrossTransientJoin(spaceId, resolved, scoped);
  if (heldActive !== null) {
    return { presence: heldActive.presence, latch: heldActive };
  }
  if (resolved.status !== 'loading') {
    return { presence: resolved, latch: { spaceId, presence: resolved } };
  }
  if (scoped !== null) {
    return { presence: scoped.presence, latch: scoped };
  }
  return { presence: resolved, latch: null };
}
