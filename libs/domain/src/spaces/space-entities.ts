/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = 'space';

export const SpaceAttr = {
  title: 'space/title',
  /** Host account id (`entityId` of the host's `spaceMembership` row). */
  hostId: 'space/hostId',
  createdAt: 'space/createdAt',
  endedAt: 'space/endedAt',
  /** Room phantom peer id (base64url hash id) for `@gamezilla/room` genesis. */
  phantomPeerId: 'space/phantomPeerId',
  /** Base64url-encoded 32-byte Ed25519 phantom peer public key. */
  phantomPublicKey: 'space/phantomPublicKey',
  /**
   * Host's stable Room identity in genesis (same across host tabs that share
   * the host room seed in secure storage for this space).
   */
  hostRoomPeerId: 'space/hostRoomPeerId',
  /** Base64url-encoded 32-byte Ed25519 public key for {@link SpaceAttr.hostRoomPeerId}. */
  hostRoomPublicKey: 'space/hostRoomPublicKey',
  /** Account ids allowed to read this space (optional; used for tighter ABAC). */
  memberUserIds: 'space/memberUserIds',
} as const;

/**
 * One membership row per signed-in account (`entityId === accountId`).
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
