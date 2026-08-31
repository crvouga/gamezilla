import { defineRoomDst, type RoomDstDef } from '../../../sim/dst';
import { matchClockDstApp } from './dst-app';

/** Framework-owned match-clock world: scheduled flag-fall under chaos. */
export const matchClockDst: RoomDstDef = defineRoomDst(matchClockDstApp, {
  id: 'room.match-clock',
});
