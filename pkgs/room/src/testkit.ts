export { openRoomSimWorld } from './sim/world';
export type {
  OpenRoomSimWorldArgs,
  RoomSimClientHandle,
  RoomSimWorld,
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
export { LoopbackRoomTransport } from './tests/harness/loopback-transport';
export type { LoopbackRoomSystem } from './tests/harness/simulator';
export { openLoopbackRoom } from './tests/harness/simulator';
export type { GenCtx, ModuleConformanceArgs } from './tests/kit';
export {
  assertHashCanonical,
  assertTotality,
  runModuleConformance,
} from './tests/kit';
