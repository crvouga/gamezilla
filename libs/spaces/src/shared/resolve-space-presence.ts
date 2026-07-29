export type SpacePresence =
  | { readonly status: 'loading' }
  | { readonly status: 'active'; readonly role: 'host' | 'guest' }
  | { readonly status: 'join'; readonly ended: boolean };

type SpaceRow = {
  readonly host_member_id: string | null;
  readonly host_account_id?: string | null;
  readonly ended_at: string | null;
};

type ParticipationRow = {
  readonly id: string;
};

type PresenceLatch = { spaceId: string; presence: SpacePresence };

function nonEmptyEqual(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a === b;
}

/** Host role from space host fields (seat still requires active membership). */
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

export function loadingPresence(args: {
  spaceEnabled: boolean;
  spaceLoading: boolean;
  spaceRow: SpaceRow | null;
  memberEnabled: boolean;
  guestLoading: boolean;
  guestRow: ParticipationRow | null;
  myId: string;
}): SpacePresence | null {
  if (!args.spaceEnabled) {
    return { status: 'loading' };
  }
  if (args.spaceLoading && args.spaceRow === null) {
    return { status: 'loading' };
  }
  // Seat requires active membership for hosts and guests (I2 / I3).
  if (args.memberEnabled && args.guestLoading && args.guestRow === null) {
    return { status: 'loading' };
  }
  return null;
}

export function resolveSpacePresence(args: {
  readonly spaceEnabled: boolean;
  readonly spaceLoading: boolean;
  readonly spaceRow: SpaceRow | null;
  readonly memberEnabled: boolean;
  readonly guestLoading: boolean;
  readonly guestRow: ParticipationRow | null;
  readonly myId: string;
}): SpacePresence {
  // Ended is terminal. Do not wait on membership loading — after end/leave the
  // active-membership watch returns null and may stay isLoading, which would
  // otherwise pin the detail screen on a spinner forever (latch already cleared).
  const endedAt = args.spaceRow?.ended_at ?? null;
  if (endedAt !== null) {
    return { status: 'join', ended: true };
  }
  const loading = loadingPresence(args);
  if (loading !== null) return loading;
  if (args.memberEnabled && args.guestRow !== null) {
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
 * `active` across transient `join` snapshots (sync/watch gaps where membership
 * briefly disappears with `isLoading: false`). Ended spaces always accept
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
