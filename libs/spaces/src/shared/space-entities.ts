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
/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = spaceNs.prefix;

export const SpaceAttr = {
  title: spaceNs.textOrNull('title', readNonEmptyStringOrNull),
  /** Host's id (account id when signed in, else install id). */
  hostId: spaceNs.textOrNull('host-id', readNonEmptyStringOrNull),
  createdAt: spaceNs.timestampOrNull('created-at', readTrimmedNullableString),
  /** `null` when the space is still live; ISO timestamp string when ended. */
  endedAt: spaceNs.timestampOrNull('ended-at', readTrimmedNullableString),
} as const;

/**
 * Guest membership only. Host is {@link SpaceAttr.hostId}. Entity id
 * `${guestId}:${spaceId}`.
 */
export const spaceMembershipNs = createAttrNamespace('space', 'membership');

export const SPACE_MEMBERSHIP_ENTITY_TYPE = spaceMembershipNs.prefix;

export const SpaceMembershipAttr = {
  guestId: spaceMembershipNs.text('guest-id', readString),
  spaceId: spaceMembershipNs.text('space-id', readString),
  joinedAt: spaceMembershipNs.timestampOrNull(
    'joined-at',
    readTrimmedNullableString
  ),
  /** `null` while membership is active; ISO timestamp when the member left. */
  leftAt: spaceMembershipNs.timestampOrNull(
    'left-at',
    readTrimmedNullableString
  ),
} as const;
