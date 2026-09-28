/**
 * `@pkgs/room-adapter-memory` — volatile in-process room adapters.
 *
 * The memory vertical of `@pkgs/room`: an authoritative-side
 * `RoomStorage`, a client-side `ClientRoomStorage`, and a socketless
 * `ClientTransport` that dispatches straight into a `RoomServer`. Used by
 * tests, the loopback testkit, and the in-process harness host.
 */

export { InMemoryClientStorage } from './client-storage';
export type {
  LoopbackRoomHost,
  LoopbackRoomTransportArgs,
} from './loopback-transport';
export { LoopbackRoomTransport } from './loopback-transport';
export {
  InMemoryRoomStorage,
  type RoomStorageTopicReplace,
  type RoomStorageTopicSnapshot,
} from './room-storage';
