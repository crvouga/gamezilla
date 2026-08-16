/**
 * In-process `ClientTransport` that talks to a {@link RoomServer} without
 * sockets. Subpath import:
 * `@pkgs/room/client/adapters/transport/loopback`.
 */

export type {
  LoopbackRoomHost,
  LoopbackRoomTransportArgs,
} from './transport';
export { LoopbackRoomTransport } from './transport';
