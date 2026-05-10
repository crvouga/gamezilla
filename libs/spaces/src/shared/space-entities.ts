import { createAttrNamespace } from '@gamezilla/lib/attribute';

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

function attrIsAbsent(v: unknown): boolean {
  return v === undefined || v === null;
}

function attrIsPresent(v: unknown): boolean {
  return v !== undefined && v !== null;
}

const spaceNs = createAttrNamespace('space');
/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = spaceNs.prefix;

export const SpaceAttr = {
  title: spaceNs('title', readNonEmptyStringOrNull),
  /** Host's id (account id when signed in, else install id). */
  hostId: spaceNs('host-id', readNonEmptyStringOrNull),
  createdAt: spaceNs('created-at', readTrimmedNullableString),
  endedAt: spaceNs('ended-at', readTrimmedNullableString),
  /** `true` when the space is still live (`endedAt` missing or null). */
  endedAtIsAbsent: spaceNs('ended-at', attrIsAbsent),
} as const;

/**
 * Guest membership only. Host is {@link SpaceAttr.hostId}. Entity id
 * `${guestId}:${spaceId}`.
 */
export const spaceMembershipNs = createAttrNamespace('space', 'membership');

export const SPACE_MEMBERSHIP_ENTITY_TYPE = spaceMembershipNs.prefix;

export const SpaceMembershipAttr = {
  guestId: spaceMembershipNs('guest-id', readString),
  /** `true` when `guestId` is present (membership row materialized). */
  guestIdIsPresent: spaceMembershipNs('guest-id', attrIsPresent),
  spaceId: spaceMembershipNs('space-id', readString),
  joinedAt: spaceMembershipNs('joined-at', readTrimmedNullableString),
  leftAt: spaceMembershipNs('left-at', readTrimmedNullableString),
  /** `true` when membership is active (`leftAt` missing or null). */
  leftAtIsAbsent: spaceMembershipNs('left-at', attrIsAbsent),
} as const;
