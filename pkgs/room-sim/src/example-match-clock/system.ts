import { defineSystem } from '@pkgs/sim';
import {
  bootRoomSim,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomSim,
  roomSystemCatalog,
} from '../scenario';
import { matchClockApp } from './app';

/** Match-clock system: scheduled flag-fall under chaos. */
export const matchClockSystem = defineSystem<RoomSim, RoomArgs>({
  name: 'room.match-clock',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomSim(session, matchClockApp, args),
  ...roomSystemCatalog(matchClockApp),
});
