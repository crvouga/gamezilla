/**
 * @gamezilla/peer-store — replicated log + wire sync.
 *
 * Smaller public surface: use `@gamezilla/peer-store/types` for UI-only types.
 * Advanced: `@gamezilla/peer-store/trust-election`, `@gamezilla/peer-store/store-errors`, etc.
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
  PeerStore,
  replayDomainEntries,
  replayEvents,
} from './peer-store';
export type { PeerStoreCoreInitConfig } from './peer-store/peer-store-config-validate';
export type {
  Command,
  HandleResult,
  NormalizedPeerStoreInit,
  PeerBootstrap,
  PeerStoreApi,
  PeerStoreInitConfig,
  PeerStoreRoomConfig,
  PeerStoreRoomRoleHost,
  PeerStoreRoomRoleJoin,
  PeerStoreSecurityConfig,
  Snapshot,
  State,
  StoreEffect,
  StoreModule,
} from './peer-store/peer-store-types';
export type { Event, Message, StoreError } from './protocol/message-types';
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
} from './protocol/store-errors';
export {
  generateId,
  isSystemEvent,
  SYSTEM_EVENT_PREFIX,
} from './protocol/utils';
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
