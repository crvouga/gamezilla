/**
 * When non-null, this actor can open the authoritative room WebSocket for the
 * space (Bearer or `anonId` on the space DO upgrade).
 */
export type SpaceRoomConnectionBootstrap = {
  spaceId: string;
  myId: string;
  /** Install UUID for `anonId` query param when using bearer JWT on `/room`. */
  installId: string;
  /** Per-tab / per-app-instance id; stable across reconnects within the mount. */
  clientId: string;
};
