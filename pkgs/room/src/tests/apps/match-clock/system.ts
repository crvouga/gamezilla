import { defineRoomSystem, type RoomSystemDef } from '../../../sim/scenario';
import { matchClockApp } from './app';

/** Framework-owned match-clock world: scheduled flag-fall under chaos. */
export const matchClockSystem: RoomSystemDef = defineRoomSystem(matchClockApp, {
  id: 'room.match-clock',
});
