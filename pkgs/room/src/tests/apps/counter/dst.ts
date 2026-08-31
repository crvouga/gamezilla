import { defineRoomDst, type RoomDstDef } from '../../../sim/dst';
import { counterDstApp } from './dst-app';

/** Framework-owned counter world: server + `clientCount` clients. */
export const counterDst: RoomDstDef = defineRoomDst(counterDstApp, {
  id: 'room.counter',
});
