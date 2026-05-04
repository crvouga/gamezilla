/**
 * @gamezilla/room — replicated log + wire sync.
 *
 * Smaller public surface: use `@gamezilla/room/types` for UI-only types.
 * Advanced: `@gamezilla/room/trust`, `@gamezilla/room/room-errors`, etc.
 */
export {
  InMemoryRoomPersistence,
  PostgresRoomPersistence,
  recoverRoomFromPersistence,
  SqliteRoomPersistence,
} from './persistence';
export type { RoomPersistence, RoomPersistenceEntry } from './persistence';
export type { LogEntry } from './persistence/log-entry';
export {
  normalizeRoomInit,
  peelRoomConfigCore,
  Room,
  replayDomainEntries,
  replayEvents,
} from './room';
export type { RoomCoreInitConfig } from './room/validate-init-config';
export type {
  Command,
  HandleResult,
  NormalizedRoomInit,
  PeerBootstrap,
  RoomApi,
  RoomCallbacks,
  RoomConfig,
  RoomConfigCore,
  RoomRoleHost,
  RoomRoleJoin,
  RoomSecurityConfig,
  Snapshot,
  State,
  RoomEffect,
  RoomModule,
} from './room/types';
export type { Event, Message, RoomError } from './events/message-types';
export {
  RoomDuplicatePeer,
  RoomInvalidPublicKey,
  RoomJoinInvalid,
  RoomJoinPeerMismatch,
  RoomLeaveInvalid,
  RoomLeaveNotSelf,
  RoomNotAuthority,
  RoomNotSynced,
  RoomSyncSessionMismatch,
  RoomTrustInvalid,
  RoomUnknownPeer,
  RoomUnknownSystemCommand,
  RoomWireAuthFailed,
} from './events/room-errors';
export { generateId, isSystemEvent, SYSTEM_EVENT_PREFIX } from './events/utils';
export {
  decodeKeyB64,
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
  randomSecretSeed,
  sha256Hex,
} from './room/security/peer-crypto';
export { derivePhantomSecretSeed } from './room/security/phantom-peer';
export { DeterministicSimulator } from './simulator';
export {
  InMemoryBus,
  InMemoryTransport,
  isRoomPresenceWirePayload,
  ROOM_PRESENCE_CHANNEL,
  WebSocketRoomTransport,
  type MessageInterceptor,
  type WebSocketRoomTransportOptions,
} from './transport';
export type {
  Transport,
  TransportMessageContext,
} from './transport/transport-types';
