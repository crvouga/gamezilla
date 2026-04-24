/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = 'space';

export const SpaceAttr = {
  title: 'space/title',
  hostId: 'space/hostId',
  createdAt: 'space/createdAt',
  endedAt: 'space/endedAt',
} as const;

/**
 * One membership row per device principal (`entityId === principalId`).
 * Joining a different space overwrites this entity so a user is in at most one space.
 */
export const SPACE_MEMBERSHIP_ENTITY_TYPE = 'spaceMembership';

export const SpaceMembershipAttr = {
  spaceId: 'spaceMembership/spaceId',
  role: 'spaceMembership/role',
  joinedAt: 'spaceMembership/joinedAt',
  leftAt: 'spaceMembership/leftAt',
} as const;

export type SpaceMembershipRole = 'host' | 'guest';
