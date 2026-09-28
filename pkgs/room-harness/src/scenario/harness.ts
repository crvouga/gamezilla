import type { Session } from '@pkgs/harness';
import type { RoomHarnessRuntime } from '../harness-api';
import type { RoomApp } from './app';

/** What observations read and actions act on. */
export type RoomHarness = {
  readonly session: Session;
  readonly app: RoomApp;
  readonly kit: RoomHarnessRuntime;
  readonly clients: RoomHarnessRuntime['clients'];
  readonly server: RoomHarnessRuntime['server'];
};
