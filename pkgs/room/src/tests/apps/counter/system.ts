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
import { counterApp } from './app';

/** Counter system: server + `clientCount` clients. */
export const counterSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'room.counter',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, counterApp, args),
});
counterSystem.host({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(counterSystem, counterApp);
