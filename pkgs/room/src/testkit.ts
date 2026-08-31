export {
  type LoopbackRoomHost,
  LoopbackRoomTransport,
  type LoopbackRoomTransportArgs,
} from './client/adapters/transport/loopback';
export { openWorld } from './sim/world';
export type {
  OpenWorldArgs,
  RoomSimClientHandle,
  World,
} from './sim/world-api';
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
