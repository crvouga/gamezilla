import { defineSystem } from '@pkgs/dst';
import {
  bootRoomSurface,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomSurface,
  registerRoomLibrary,
  roomVirtual,
} from '../../../sim/scenario';
import { matchClockApp } from './app';

/** Match-clock system: scheduled flag-fall under chaos. */
export const matchClockSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'room.match-clock',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, matchClockApp, args),
});
matchClockSystem.host({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(matchClockSystem, matchClockApp);
