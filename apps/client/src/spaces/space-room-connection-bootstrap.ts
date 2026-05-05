/**
 * When non-null, this actor can open the authoritative room WebSocket for the
 * space (Bearer or `anonId` on the relay).
 */
export type SpaceRoomConnectionBootstrap = {
  spaceId: string;
  myId: string;
};
