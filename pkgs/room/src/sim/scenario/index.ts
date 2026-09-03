/**
 * Room system kernel. Runs and action replay are framework-owned:
 * {@link defineRoomSystem} + `script` / `explore` / `replay` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  RoomSystemAction,
} from './actions';
export { isDomainOp, isLibraryAction } from './actions';
export type { DomainModelHooks, RoomApp } from './app';
export { applyTaggedRoomAction } from './apply-tagged';
export type {
  DefineRoomSystemOpts,
  RoomSystemDef,
} from './define-room-system';
export {
  defineRoomSystem,
  roomVirtualHost,
  SIM_START_MS,
} from './define-room-system';
export { dispatchRoomSystemAction } from './dispatch';
export type { RoomKnobs } from './knobs';
export { arbRoomKnobs, arbSeed } from './knobs';
export { MILD_NET_FAULTS } from './library-arbs';
export {
  applyActionToModel,
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
  CLIENT_IDS,
  clientLive,
  domainOp,
  initialRoomModel,
  modelAllowsAction,
  NET_FAULT_PROFILES,
  type RoomModel,
  type RoomReal,
  SIM_PBT_CRASH_EVENTS,
} from './model';
export {
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
  invariants,
  invariantViolations,
  lastRejection,
  logSeq,
  partitioned,
  quiet,
  ROOM_PROPERTIES,
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
  LIBRARY_ACTIONS,
  partition,
  ROOM_ACTIONS,
  release,
  restart,
  revive,
  roomActions,
  serverCrash,
  serverRestart,
  setFaults,
  setNet,
  takeOver,
} from './room-actions';
export type { RoomSurface } from './surface';
