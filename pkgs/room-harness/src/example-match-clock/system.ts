import { defineSystem } from '@pkgs/harness';
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomHarness,
  roomSystemCatalog,
} from '../scenario';
import { matchClockApp } from './app';

/** Match-clock system: scheduled flag-fall under chaos. */
export const matchClockSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.match-clock',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, matchClockApp, args),
  ...roomSystemCatalog(matchClockApp),
});
