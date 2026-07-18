import { createAttrNamespace } from '@pkgs/attribute';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNonEmptyStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const spaceNs = createAttrNamespace('space');
/** Sync entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = spaceNs.prefix;

function readVisibility(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : 'private';
}

function readMemberCount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 1;
  }
  return 1;
}

export const SpaceAttr = {
  title: spaceNs.textOrNull('title', readNonEmptyStringOrNull),
  /**
   * Creating install device id (legacy / reconnect hint). Host *authority* is
   * {@link SpaceAttr.hostMemberId}.
   */
  hostId: spaceNs.textOrNull('host-id', readNonEmptyStringOrNull).indexed(),
  /** Indexed + sortable: the lobby lists live spaces newest-first. */
  createdAt: spaceNs
    .timestampOrNull('created-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  /** `null` when the space is still live; ISO timestamp string when ended. */
  endedAt: spaceNs
    .timestampOrNull('ended-at', readTrimmedNullableString)
    .indexed(),
  /** `public` | `friends` | `private`. Indexed for lobby section filters. */
  visibility: spaceNs.text('visibility', readVisibility).indexed(),
  /** Host account id when signed in; null for anonymous hosts. */
  hostAccountId: spaceNs
    .textOrNull('host-account-id', readNonEmptyStringOrNull)
    .indexed(),
  /**
   * Host member id (`accountId ?? deviceId`). Authoritative for host checks.
   */
  hostMemberId: spaceNs
    .textOrNull('host-member-id', readNonEmptyStringOrNull)
    .indexed(),
  hostUsername: spaceNs.textOrNull('host-username', readNonEmptyStringOrNull),
  hostAvatarConfig: spaceNs.textOrNull(
    'host-avatar-config',
    readNonEmptyStringOrNull
  ),
  activeMemberCount: spaceNs.integer('active-member-count', readMemberCount),
} as const;

/**
 * User-scoped membership: `${memberId}:${spaceId}`.
 */
export const spaceMembershipNs = createAttrNamespace('space', 'membership');

export const SPACE_MEMBERSHIP_ENTITY_TYPE = spaceMembershipNs.prefix;

export const SpaceMembershipAttr = {
  /** Member id (account when signed in, else device). */
  memberId: spaceMembershipNs.text('member-id', readString).indexed(),
  spaceId: spaceMembershipNs.text('space-id', readString).indexed(),
  /** Display identity (same as member id for current model). */
  profileId: spaceMembershipNs
    .textOrNull('profile-id', readNonEmptyStringOrNull)
    .indexed(),
  joinedAt: spaceMembershipNs
    .timestampOrNull('joined-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  leftAt: spaceMembershipNs
    .timestampOrNull('left-at', readTrimmedNullableString)
    .indexed(),
} as const;

/**
 * Device participation under a membership: `${deviceId}:${spaceId}`.
 */
export const spaceParticipationNs = createAttrNamespace(
  'space',
  'participation'
);

export const SPACE_PARTICIPATION_ENTITY_TYPE = spaceParticipationNs.prefix;

export const SpaceParticipationAttr = {
  spaceId: spaceParticipationNs.text('space-id', readString).indexed(),
  memberId: spaceParticipationNs.text('member-id', readString).indexed(),
  deviceId: spaceParticipationNs.text('device-id', readString).indexed(),
  deviceLabel: spaceParticipationNs.textOrNull(
    'device-label',
    readNonEmptyStringOrNull
  ),
  joinedAt: spaceParticipationNs
    .timestampOrNull('joined-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  leftAt: spaceParticipationNs
    .timestampOrNull('left-at', readTrimmedNullableString)
    .indexed(),
} as const;
