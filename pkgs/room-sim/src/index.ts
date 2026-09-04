/**
 * Test / sim host seam for `@pkgs/room`.
 * Import from `@pkgs/room-sim` only — not for product apps/libs.
 */

export {
  type LoopbackRoomHost,
  LoopbackRoomTransport,
  type LoopbackRoomTransportArgs,
} from '@pkgs/room-adapter-memory';
export {
  AuthzFixtureModule,
  authzCount,
  authzOwner,
  Bump,
  Claim,
} from './authz-module';
export { bootCounter } from './boot-counter';
export type { LoopbackRoomSystem } from './boot-loopback';
export { openLoopbackRoom } from './boot-loopback';
export {
  counterValue,
  Decrement,
  Increment,
  TestCounterModule,
} from './counter-module';
export {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  deadlineAt,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from './deadline-module';
export { authzApp } from './example-authz/app';
export { authzSystem } from './example-authz/system';
export { counterApp } from './example-counter/app';
export { counterSystem } from './example-counter/system';
export { deadlineApp } from './example-deadline/app';
export { deadlineSystem } from './example-deadline/system';
export { matchClockApp } from './example-match-clock/app';
export { matchClockSystem } from './example-match-clock/system';
export { expectInSync } from './expect-in-sync';
export {
  FlagFall,
  MatchClockFixtureModule,
  Move,
  Move as MatchClockMove,
  matchClockBlackMs,
  matchClockStatus,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  StartMatch,
} from './match-clock-module';
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
  RoomSim,
  RoomSystemDef,
} from './scenario';
export {
  addClient,
  armCrashAt,
  bootRoomSim,
  clientHash,
  clientState,
  clock,
  connect,
  connected,
  crash,
  disconnect,
  dispatch,
  domainOp,
  injectFromServer,
  injectToServer,
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
  SIM_START_MS,
  serverCrash,
  serverCrashed,
  serverHash,
  serverRestart,
  serverState,
  takeOver,
} from './scenario';
export type { RoomSimClient } from './sim-api';
export { commandWire } from './wire-helpers';
