/**
 * Test / harness host seam for `@pkgs/room`.
 * Import from `@pkgs/room-harness` only — not for product apps/libs.
 */

export {
  type LoopbackRoomHost,
  LoopbackRoomTransport,
  type LoopbackRoomTransportArgs,
} from '@pkgs/room-adapter-memory';
export type { RoomHarnessClient } from './api';
export type { LoopbackRoomSystem } from './boot-loopback';
export { openLoopbackRoom } from './boot-loopback';
export {
  deliverQueuedRoomChange,
  hearRoomChangeCounted,
  holdRoomChanges,
  pendingRoomChangeIds,
  type QueuedRoomChange,
  roomChangeReceipts,
  stopAsRoomChangeCounts,
} from './commit-recovery';
export { exampleApp, exampleSystem } from './example-app';
export { expectInSync } from './expect-in-sync';
export {
  assertHashCanonical,
  assertTotality,
  runModuleConformance,
} from './module-conformance-index';
export type { GenCtx, ModuleConformanceArgs } from './module-conformance-types';
export {
  expectHashMatch,
  isConnected,
  readClient,
  readClientHash,
  readRejection,
  readServer,
} from './read-state';
export type {
  DomainOp,
  RoomApp,
  RoomArgs,
  RoomHarness,
  RoomSystemDef,
} from './scenario';
export {
  addClient,
  armCrashAt,
  bootRoomHarness,
  clientHash,
  clientState,
  clock,
  connect,
  connected,
  crash,
  disconnect,
  dispatch,
  domainOp,
  HARNESS_START_MS,
  injectFromServer,
  injectToServer,
  inSync,
  lastRejection,
  logSeq,
  partition,
  pauseNetwork,
  ROOM_ARGS,
  ROOM_DRAW,
  ROOM_LIBRARY_PROPERTIES,
  ROOM_VIRTUAL_RUNTIME,
  recoverAll,
  restart,
  restoreNetwork,
  resumeNetwork,
  roomEpoch,
  roomLibraryActions,
  roomSystemCatalog,
  roomVirtual,
  rosterSize,
  serverCrash,
  serverCrashed,
  serverHash,
  serverRestart,
  serverState,
  takeOver,
} from './scenario';
export { commandWire } from './wire-helpers';
