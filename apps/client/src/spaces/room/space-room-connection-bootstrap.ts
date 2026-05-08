/**
 * When non-null, this actor can open the authoritative room WebSocket for the
 * space (Bearer or `anonId` on the space DO upgrade).
 */
export type SpaceRoomConnectionBootstrap = {
  spaceId: string;
  myId: string;
  /** Install UUID for `anonId` query param when using bearer JWT on `/space/ws`. */
  installId: string;
};
