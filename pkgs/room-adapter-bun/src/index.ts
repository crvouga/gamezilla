/** How the gateway in front of the host hands it a connection's grants. */
export { decodeRoomGrants, ROOM_GRANTS_HEADER } from '@pkgs/room/server';
export {
  type BunRoomHost,
  type BunRoomHostDeps,
  type BunRoomSocketData,
  createBunRoomHost,
} from './bun-room-host';
