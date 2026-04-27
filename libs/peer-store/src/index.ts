/**
 * @gamezilla/peer-store — replicated log + wire sync.
 *
 * Smaller public surface: use `@gamezilla/peer-store/types` for UI-only types.
 * Advanced: `@gamezilla/peer-store/trust`, `@gamezilla/peer-store/store-errors`, etc.
 */
export {
  InMemoryPeerStorePersistence,
  PostgresPeerStorePersistence,
  recoverPeerStoreFromPersistence,
  SqlitePeerStorePersistence,
} from './persistence';
export type {
  PeerStorePersistence,
  PeerStorePersistenceEntry,
} from './persistence';
export type { LogEntry } from './persistence/log-entry';
export {
  normalizePeerStoreInit,
  peelPeerStoreRoomConfigCore,
  PeerStore,
  replayDomainEntries,
  replayEvents,
} from './store';
export type { PeerStoreCoreInitConfig } from './store/validate-init-config';
export type {
  Command,
  HandleResult,
  NormalizedPeerStoreInit,
  PeerBootstrap,
  PeerStoreApi,
  PeerStoreCallbacks,
  PeerStoreRoomConfig,
  PeerStoreRoomConfigCore,
  PeerStoreRoomRoleHost,
  PeerStoreRoomRoleJoin,
  PeerStoreSecurityConfig,
  Snapshot,
  State,
  StoreEffect,
  StoreModule,
} from './store/types';
export type { Event, Message, StoreError } from './events/message-types';
export {
  PeerStoreDuplicatePeer,
  PeerStoreInvalidPublicKey,
  PeerStoreJoinInvalid,
  PeerStoreJoinPeerMismatch,
  PeerStoreLeaveInvalid,
  PeerStoreLeaveNotSelf,
  PeerStoreNotAuthority,
  PeerStoreNotSynced,
  PeerStoreSyncSessionMismatch,
  PeerStoreTrustInvalid,
  PeerStoreUnknownPeer,
  PeerStoreUnknownSystemCommand,
  PeerStoreWireAuthFailed,
} from './events/store-errors';
export {
  generateId,
  isSystemEvent,
  SYSTEM_EVENT_PREFIX,
} from './events/utils';
export { DeterministicSimulator } from './simulator';
export {
  InMemoryBus,
  InMemoryTransport,
  type MessageInterceptor,
} from './transport';
export type {
  Transport,
  TransportMessageContext,
} from './transport/transport-types';
