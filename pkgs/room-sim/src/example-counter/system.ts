import { defineSystem } from '@pkgs/sim';
import {
  bootRoomSim,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomSim,
  roomSystemCatalog,
} from '../scenario';
import { counterApp } from './app';

/** Counter system: server + `clientCount` clients. */
export const counterSystem = defineSystem<RoomSim, RoomArgs>({
  name: 'room.counter',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomSim(session, counterApp, args),
  ...roomSystemCatalog(counterApp),
});
