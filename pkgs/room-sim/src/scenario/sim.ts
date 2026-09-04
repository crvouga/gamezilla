import type { Session } from '@pkgs/sim';
import type { RoomSimRuntime } from '../sim-api';
import type { RoomApp } from './app';

/** What observations read and actions act on. */
export type RoomSim = {
  readonly session: Session;
  readonly app: RoomApp;
  readonly kit: RoomSimRuntime;
  readonly clients: RoomSimRuntime['clients'];
  readonly server: RoomSimRuntime['server'];
};
