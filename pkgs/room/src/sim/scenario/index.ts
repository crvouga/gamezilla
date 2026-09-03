/**
 * Room system kernel. Worlds and action replay are framework-owned:
 * {@link defineRoomSystem} + `start` / `check` / `replay` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  RoomSystemAction,
} from './actions';
export { isDomainOp, isLibraryAction } from './actions';
export type { DomainModelHooks, RoomApp } from './app';
export { applyRoomAction, playRoomActions } from './apply-room-action';
export type {
  DefineRoomSystemOpts,
  RoomSystemDef,
} from './define-room-system';
export {
  defineRoomSystem,
  WORLD_START_MS,
} from './define-room-system';
export { dispatchRoomSystemAction } from './dispatch';
export type { RoomWorldKnobs } from './knobs';
export { arbRoomKnobs, arbSeed } from './knobs';
export { MILD_NET_FAULTS } from './library-arbs';
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
  serverCrashed,
  serverHash,
  serverState,
} from './observations';
export { prepareClientsForConverge } from './play';
export type { ReplayRoomInputs } from './replay';
export { replayRoom, replayRoomPin } from './replay';
export {
  addClient,
  addSpectator,
  armCrashAt,
  asymmetricLink,
  clearFaults,
  clearLocalData,
  connect,
  converge,
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
  passTime,
  ROOM_ACTIONS,
  release,
  restart,
  roomActions,
  serverCrash,
  serverRestart,
  setFaults,
  setNet,
  takeOver,
} from './room-actions';
export { type StartRoomOpts, startRoom } from './start-room';
export type { RoomSurface } from './surface';
export {
  applyActionToModel,
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
  CLIENT_IDS,
  clientLive,
  domainOp,
  initialWorldModel,
  modelAllowsAction,
  NET_FAULT_PROFILES,
  WORLD_PBT_CRASH_EVENTS,
  type WorldModel,
  type WorldReal,
} from './world-model';
