/**
 * Room DST kernel. Worlds and action replay are framework-owned:
 * {@link defineRoomDst} + `assertDst` / `replayDst` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  RoomDstAction,
} from './actions';
export { isDomainOp, isLibraryAction } from './actions';
export type { DomainModelHooks, RoomDstApp } from './app';
export type {
  DefineRoomDstOpts,
  RoomDstDef,
  RoomDstWorld,
} from './define-room-dst';
export { defineRoomDst, playRoomActions } from './define-room-dst';
export { dispatchRoomDstAction } from './dispatch';
export type { RoomWorldKnobs } from './knobs';
export { arbRoomKnobs, ROOM_DST_KNOBS } from './knobs';
export { libraryActionArbs, MILD_NET_FAULTS } from './library-arbs';
export { prepareClientsForConverge, prepareReplayAction } from './play';
export type { ReplayRoomInputs } from './replay';
export { replayRoomDst, replayRoomPin } from './replay';
export type { RoomDstSystem } from './system';
export { requireWorld as roomDstWorld } from './system';
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
export type { RoomDstWorldSurface } from './world-surface';
