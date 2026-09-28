import { defineSystem } from '@pkgs/harness';
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomHarness,
  roomSystemCatalog,
} from '../scenario';
import { counterApp } from './app';

/** Counter system: server + `clientCount` clients. */
export const counterSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.counter',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, counterApp, args),
  ...roomSystemCatalog(counterApp),
});
