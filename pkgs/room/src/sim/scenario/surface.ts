import type { Session } from '@pkgs/dst';
import type { World } from '../world-api';
import type { RoomApp } from './app';

/** What observations read and actions act on. */
export type RoomSurface = {
  readonly session: Session;
  readonly app: RoomApp;
  readonly world: World;
  readonly clients: World['clients'];
  readonly server: World['server'];
};
