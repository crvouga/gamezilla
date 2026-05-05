/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = 'space';

export const SpaceAttr = {
  title: 'space/title',
  /** Host's id (account id when signed in, else install id). */
  hostId: 'space/hostId',
  createdAt: 'space/createdAt',
  endedAt: 'space/endedAt',
} as const;

/**
 * Guest membership only. Host is {@link SpaceAttr.hostId}. Entity id
 * `${guestId}:${spaceId}`.
 */
export const SPACE_MEMBERSHIP_ENTITY_TYPE = 'spaceMembership';

export const SpaceMembershipAttr = {
  guestId: 'spaceMembership/guestId',
  spaceId: 'spaceMembership/spaceId',
  joinedAt: 'spaceMembership/joinedAt',
  leftAt: 'spaceMembership/leftAt',
} as const;
