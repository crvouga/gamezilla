/**
 * @gamezilla/room — server-authoritative sessions + optimistic client queue.
 *
 * Server entry: `@gamezilla/room/server`. Tests: `@gamezilla/room/testkit`.
 */
export type {
  HandleResult,
  LogEntry,
  RoomCommand,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from './types';
export { WIRE_VERSION } from './protocol/wire';
export {
  parseClientToServerWire,
  parseServerToClientWire,
  type ClientToServerWire,
  type ServerToClientWire,
} from './protocol/wire';
export { newCommandId } from './protocol/ids';
export { Room } from './client/room';
export type { RoomClientConfig } from './client/room';
export type { ClientTransport, ClientTransportHandlers } from './client/transport';
export type { ClientRoomStorage, QueuedCommand } from './client/storage';
export { WebSocketRoomTransport } from './client/adapters/websocket';
export type { WebSocketRoomTransportOptions } from './client/adapters/websocket';
export { InMemoryClientStorage } from './client/adapters/memory-storage';
export { SecureClientRoomStorage } from './client/adapters/secure-storage';
export { WebClientStorage } from './client/adapters/web-storage';

export { openLoopbackRoom } from './testkit/simulator';
export type { LoopbackRoomSystem } from './testkit/simulator';
export { LoopbackRoomTransport } from './testkit/loopback-transport';
export { Increment, Decrement, TestCounterModule } from './testkit/counter-module';
