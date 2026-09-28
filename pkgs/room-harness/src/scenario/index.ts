/**
 * Room system kernel. Each app declares a literal `defineSystem` whose
 * `create` calls {@link bootRoomHarness} and spreads {@link roomSystemCatalog};
 * scripts run through `system.run` / `.explore` / `.replay`.
 */

export type { DomainOp } from './actions';
export { domainOp } from './actions';
export type { RoomApp } from './app';
export type { RoomArgs } from './args';
export { ROOM_ARGS, ROOM_DRAW } from './args';
export type { BootRoomOpts, RoomSystemDef } from './boot';
export {
  bootRoomHarness,
  HARNESS_START_MS,
  ROOM_LIBRARY_PROPERTIES,
  ROOM_VIRTUAL_RUNTIME,
  roomEpoch,
  roomLibraryActions,
  roomSystemCatalog,
  roomVirtual,
} from './boot';
export { MILD_NET_FAULTS, NET_FAULT_PROFILES } from './faults';
export type { RoomHarness } from './harness';
export {
  buildMalformedMessageRaw,
  MALFORMED_MESSAGE_INJECT_KINDS,
  type MalformedMessageInjectKind,
} from './malformed-messages';
export {
  allLiveConnected,
  caps,
  clientHash,
  clientIds,
  clientState,
  clock,
  connected,
  crashedIds,
  downClients,
  heldClients,
  impairedClients,
  inSync,
  invariants,
  invariantViolations,
  lastRejection,
  linkUpClients,
  logSeq,
  lossyNetwork,
  partitioned,
  quiet,
  releasableClients,
  rosterSize,
  seed,
  serverCrashed,
  serverHash,
  serverState,
  staysInSync,
} from './observations';
export { prepareClientsForInSync } from './play';
export {
  addClient,
  addSpectator,
  armCrashAt,
  asymmetricLink,
  clearFaults,
  clearLocalData,
  connect,
  crash,
  disconnect,
  dispatch,
  domain,
  domainAction,
  down,
  injectFromServer,
  injectToServer,
  malformedMessages,
  partition,
  pauseNetwork,
  recoverAll,
  restart,
  restoreNetwork,
  resumeNetwork,
  serverCrash,
  serverRestart,
  setFaults,
  setNet,
  takeOver,
} from './room-actions';
