/**
 * Room system kernel. Worlds and action replay are framework-owned:
 * {@link defineRoomSystem} + `runScenario` / `replay` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  RoomSystemAction,
} from './actions';
export { isDomainOp, isLibraryAction } from './actions';
export type { DomainModelHooks, RoomApp } from './app';
export type {
  DefineRoomSystemOpts,
  RoomSystemDef,
  RoomSystemWorld,
} from './define-room-system';
export { defineRoomSystem, playRoomActions } from './define-room-system';
export { dispatchRoomSystemAction } from './dispatch';
export type { RoomWorldKnobs } from './knobs';
export { arbRoomKnobs, ROOM_SYSTEM_KNOBS } from './knobs';
export { MILD_NET_FAULTS } from './library-arbs';
export { prepareClientsForConverge } from './play';
export type { ReplayRoomInputs } from './replay';
export { replayRoom, replayRoomPin } from './replay';
export type { RoomSystem } from './system';
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
export type { RoomSystemWorldSurface } from './world-surface';
