import { defineRoomSystem, type RoomSystemDef } from '../../../sim/system';
import { authzApp } from './app';

/** Framework-owned authz world: owner-gated domain ops. */
export const authzSystem: RoomSystemDef = defineRoomSystem(authzApp, {
  id: 'room.authz',
});
