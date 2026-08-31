import { defineRoomDst, type RoomDstDef } from '../../../sim/dst';
import { authzDstApp } from './dst-app';

/** Framework-owned authz world: owner-gated domain ops. */
export const authzDst: RoomDstDef = defineRoomDst(authzDstApp, {
  id: 'room.authz',
});
