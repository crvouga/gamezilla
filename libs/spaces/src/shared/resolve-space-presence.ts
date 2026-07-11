export type SpacePresence =
  | { readonly status: 'loading' }
  | { readonly status: 'active'; readonly role: 'host' | 'guest' }
  | { readonly status: 'join'; readonly ended: boolean };

type SpaceRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

type GuestMembershipRow = {
  readonly id: string;
};

export function isActiveHost(spaceRow: SpaceRow | null, myId: string): boolean {
  const hostId = spaceRow?.host_id ?? null;
  const endedAt = spaceRow?.ended_at ?? null;
  return (
    endedAt === null && hostId !== null && hostId.length > 0 && hostId === myId
  );
}

export function loadingPresence(args: {
  spaceEnabled: boolean;
  spaceLoading: boolean;
  spaceRow: SpaceRow | null;
  memberEnabled: boolean;
  guestLoading: boolean;
  guestRow: GuestMembershipRow | null;
  myId: string;
}): SpacePresence | null {
  if (!args.spaceEnabled) {
    return { status: 'loading' };
  }
  if (args.spaceLoading && args.spaceRow === null) {
    return { status: 'loading' };
  }
  if (
    args.memberEnabled &&
    args.guestLoading &&
    args.guestRow === null &&
    !isActiveHost(args.spaceRow, args.myId)
  ) {
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
  readonly guestRow: GuestMembershipRow | null;
  readonly myId: string;
}): SpacePresence {
  const loading = loadingPresence(args);
  if (loading !== null) return loading;
  if (args.memberEnabled && args.guestRow !== null) {
    return { status: 'active', role: 'guest' };
  }
  if (args.memberEnabled && isActiveHost(args.spaceRow, args.myId)) {
    return { status: 'active', role: 'host' };
  }
  const endedAt = args.spaceRow?.ended_at ?? null;
  return { status: 'join', ended: endedAt !== null };
}

export function latchStaleSpacePresence(
  spaceId: string,
  resolved: SpacePresence,
  latch: { spaceId: string; presence: SpacePresence } | null
): {
  presence: SpacePresence;
  latch: { spaceId: string; presence: SpacePresence } | null;
} {
  if (spaceId.length === 0) {
    return { presence: resolved, latch: null };
  }
  if (latch !== null && latch.spaceId !== spaceId) {
    latch = null;
  }
  if (resolved.status !== 'loading') {
    return {
      presence: resolved,
      latch: { spaceId, presence: resolved },
    };
  }
  if (latch !== null && latch.spaceId === spaceId) {
    return { presence: latch.presence, latch };
  }
  return { presence: resolved, latch };
}
