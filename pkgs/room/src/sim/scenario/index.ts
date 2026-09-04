/**
 * Room system kernel. Each app declares a literal `defineSystem` whose
 * `create` calls {@link bootRoomSurface} and then {@link registerRoomLibrary};
 * scripts run through `system.script` / `.explore` / `.replay`.
 */

export type { DomainOp } from './actions';
export { domainOp } from './actions';
export type { RoomApp } from './app';
export type { RoomArgs } from './args';
export { ROOM_ARGS, ROOM_DRAW } from './args';
export type { BootRoomOpts, RoomSystemDef } from './boot';
export {
  bootRoomSurface,
  registerRoomLibrary,
  roomEpoch,
  roomVirtual,
  SIM_START_MS,
} from './boot';
export {
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
} from './byzantine';
export { MILD_NET_FAULTS, NET_FAULT_PROFILES } from './faults';
export {
  allLiveConnected,
  caps,
  clientHash,
  clientIds,
  clientState,
  clock,
  connected,
  converged,
  converges,
  crashedIds,
  downClients,
  heldClients,
  impairedClients,
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
} from './observations';
export { prepareClientsForConverge } from './play';
export {
  addClient,
  addSpectator,
  armCrashAt,
  asymmetricLink,
  byzantine,
  clearFaults,
  clearLocalData,
  connect,
  crash,
  disconnect,
  dispatch,
  domain,
  domainAction,
  down,
  heal,
  hold,
  injectFromServer,
  injectToServer,
  partition,
  release,
  restart,
  revive,
  serverCrash,
  serverRestart,
  setFaults,
  setNet,
  takeOver,
} from './room-actions';
export type { RoomSurface } from './surface';
