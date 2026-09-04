export {
  type LoopbackRoomHost,
  LoopbackRoomTransport,
  type LoopbackRoomTransportArgs,
} from './client/adapters/transport/loopback';
export type { RoomSimClientHandle } from './sim/kit-api';
export type {
  DomainOp,
  RoomApp,
  RoomArgs,
  RoomSurface,
  RoomSystemDef,
} from './sim/scenario';
export {
  addClient,
  bootRoomSurface,
  clientHash,
  clientState,
  crash,
  dispatch,
  domainOp,
  heal,
  hold,
  lastRejection,
  partition,
  ROOM_ARGS,
  ROOM_DRAW,
  registerRoomLibrary,
  release,
  restart,
  revive,
  roomVirtual,
  SIM_START_MS,
  serverHash,
  serverState,
} from './sim/scenario';
export { expectConverged } from './tests/expect-converged';
export {
  AuthzFixtureModule,
  authzCount,
  authzOwner,
  Bump,
  Claim,
} from './tests/fixtures/authz-module';
export {
  counterValue,
  Decrement,
  Increment,
  TestCounterModule,
} from './tests/fixtures/counter-module';
export {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  deadlineAt,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from './tests/fixtures/deadline-module';
export {
  FlagFall,
  MatchClockFixtureModule,
  Move as MatchClockMove,
  matchClockBlackMs,
  matchClockStatus,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  StartMatch,
} from './tests/fixtures/match-clock-module';
export type { LoopbackRoomSystem } from './tests/harness/simulator';
export { openLoopbackRoom } from './tests/harness/simulator';
export type { GenCtx, ModuleConformanceArgs } from './tests/kit';
export {
  assertHashCanonical,
  assertTotality,
  runModuleConformance,
} from './tests/kit';
