/**
 * When non-null, this actor can open the authoritative room WebSocket for the
 * space (Bearer or `anonId` on the space DO upgrade).
 */
export type SpaceRoomConnectionBootstrap = {
  spaceId: string;
  myId: string;
  /** Policy allows this device to host the local space. */
  hostsSpace: boolean;
  /** Install UUID for `anonId` query param when using bearer JWT on `/room`. */
  installId: string;
  /** Per-tab client id; stable for the open-space session (survives detail remounts). */
  clientId: string;
};
