import type { Session } from '@pkgs/dst';
import type { RoomKit } from '../kit-api';
import type { RoomApp } from './app';

/** What observations read and actions act on. */
export type RoomSurface = {
  readonly session: Session;
  readonly app: RoomApp;
  readonly kit: RoomKit;
  readonly clients: RoomKit['clients'];
  readonly server: RoomKit['server'];
};
