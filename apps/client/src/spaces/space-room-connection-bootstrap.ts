/**
 * When non-null, the signed-in user can open the authoritative room WebSocket
 * for this space.
 */
export type SpaceRoomConnectionBootstrap = {
  spaceId: string;
  accountId: string;
};
