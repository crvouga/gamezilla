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
  /** Hosting install device id. Indexed so the `WHERE host-id = ?` lookup
   * during reconnect is a single btree probe. */
  hostId: spaceNs.textOrNull('host-id', readNonEmptyStringOrNull).indexed(),
  /** Indexed + sortable: the lobby lists live spaces newest-first
   * (`ORDER BY created-at DESC`); without a btree this sorts the entire
   * space table on every list refresh. */
  createdAt: spaceNs
    .timestampOrNull('created-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  /** `null` when the space is still live; ISO timestamp string when ended.
   * Indexed so "list live spaces" (`WHERE ended-at IS NULL`) is fast. */
  endedAt: spaceNs
    .timestampOrNull('ended-at', readTrimmedNullableString)
    .indexed(),
  /** `public` | `friends` | `private`. Indexed for lobby section filters. */
  visibility: spaceNs.text('visibility', readVisibility).indexed(),
  /** Host account id when signed in; null for anonymous hosts. */
  hostAccountId: spaceNs
    .textOrNull('host-account-id', readNonEmptyStringOrNull)
    .indexed(),
  hostUsername: spaceNs.textOrNull(
    'host-username',
    readNonEmptyStringOrNull
  ),
  hostAvatarConfig: spaceNs.textOrNull(
    'host-avatar-config',
    readNonEmptyStringOrNull
  ),
  activeMemberCount: spaceNs.integer('active-member-count', readMemberCount),
} as const;

/**
 * `${deviceId}:${spaceId}`. `guest_id` is the install device seat.
 */
export const spaceMembershipNs = createAttrNamespace('space', 'membership');

export const SPACE_MEMBERSHIP_ENTITY_TYPE = spaceMembershipNs.prefix;

export const SpaceMembershipAttr = {
  /** Install device seat id. Indexed for "what spaces is this device in". */
  guestId: spaceMembershipNs.text('guest-id', readString).indexed(),
  /** Indexed: "who's in this space" is read on every member join/leave. */
  spaceId: spaceMembershipNs.text('space-id', readString).indexed(),
  /** Display identity: account id when signed in, else device id. */
  profileId: spaceMembershipNs
    .textOrNull('profile-id', readNonEmptyStringOrNull)
    .indexed(),
  /** Denormalized device label snapshot at join/create. */
  deviceLabel: spaceMembershipNs.textOrNull(
    'device-label',
    readNonEmptyStringOrNull
  ),
  /** Indexed + sortable: the membership UI sorts members by join order
   * (`ORDER BY joined-at ASC`) so this needs a btree to avoid a per-space
   * sort over the full member set. */
  joinedAt: spaceMembershipNs
    .timestampOrNull('joined-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  /** `null` while membership is active; ISO timestamp when the member left.
   * Indexed so "active members of space X" (`WHERE left-at IS NULL`) is fast. */
  leftAt: spaceMembershipNs
    .timestampOrNull('left-at', readTrimmedNullableString)
    .indexed(),
} as const;
