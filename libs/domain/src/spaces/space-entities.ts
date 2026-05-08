import { createAttrNamespace } from '@gamezilla/lib/attribute';

/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = 'space';

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

export const SpaceAttr = {
  title: spaceNs('title', readNonEmptyStringOrNull),
  /** Host's id (account id when signed in, else install id). */
  hostId: spaceNs('hostId', readNonEmptyStringOrNull),
  createdAt: spaceNs('createdAt', readTrimmedNullableString),
  endedAt: spaceNs('endedAt', readTrimmedNullableString),
  /** `true` when the space is still live (`endedAt` missing or null). */
  endedAtIsAbsent: spaceNs('endedAt', attrIsAbsent),
} as const;

/**
 * Guest membership only. Host is {@link SpaceAttr.hostId}. Entity id
 * `${guestId}:${spaceId}`.
 */
export const SPACE_MEMBERSHIP_ENTITY_TYPE = 'spaceMembership';

const spaceMembershipNs = createAttrNamespace('spaceMembership');

export const SpaceMembershipAttr = {
  guestId: spaceMembershipNs('guestId', readString),
  /** `true` when `guestId` is present (membership row materialized). */
  guestIdIsPresent: spaceMembershipNs('guestId', attrIsPresent),
  spaceId: spaceMembershipNs('spaceId', readString),
  joinedAt: spaceMembershipNs('joinedAt', readTrimmedNullableString),
  leftAt: spaceMembershipNs('leftAt', readTrimmedNullableString),
  /** `true` when membership is active (`leftAt` missing or null). */
  leftAtIsAbsent: spaceMembershipNs('leftAt', attrIsAbsent),
} as const;
