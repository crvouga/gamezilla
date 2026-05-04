/** PatchDB entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = 'space';

export const SpaceAttr = {
  title: 'space/title',
  hostId: 'space/hostId',
  createdAt: 'space/createdAt',
  endedAt: 'space/endedAt',
  /** Room phantom peer id (base64url hash id) for `@gamezilla/room` genesis. */
  phantomPeerId: 'space/phantomPeerId',
  /** Base64url-encoded 32-byte Ed25519 phantom peer public key. */
  phantomPublicKey: 'space/phantomPublicKey',
} as const;

/**
 * One membership row per device (`entityId === deviceId`).
 * Joining a different space overwrites this entity so a user is in at most one space.
 */
export const SPACE_MEMBERSHIP_ENTITY_TYPE = 'spaceMembership';

export const SpaceMembershipAttr = {
  spaceId: 'spaceMembership/spaceId',
  role: 'spaceMembership/role',
  joinedAt: 'spaceMembership/joinedAt',
  leftAt: 'spaceMembership/leftAt',
  /** Self-certifying Room `peerId` for this device in this space. */
  peerId: 'spaceMembership/peerId',
  /** Base64url-encoded 32-byte Ed25519 public key for {@link SpaceMembershipAttr.peerId}. */
  peerPublicKey: 'spaceMembership/peerPublicKey',
} as const;

export type SpaceMembershipRole = 'host' | 'guest';
