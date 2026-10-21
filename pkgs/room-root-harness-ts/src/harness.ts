import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from './api';
import type { RoomApp } from './scenario-app';

/** What observations read and actions act on. */
export type RoomHarness = {
  readonly session: Session;
  readonly app: RoomApp;
  readonly kit: RoomHarnessRuntime;
  readonly clients: RoomHarnessRuntime['clients'];
  readonly server: RoomHarnessRuntime['server'];
};
