import { defineRoomSystem, type RoomSystemDef } from '../../../sim/scenario';
import { authzApp } from './app';

/** Framework-owned authz system: owner-gated domain ops. */
export const authzSystem: RoomSystemDef = defineRoomSystem(authzApp, {
  name: 'room.authz',
});
