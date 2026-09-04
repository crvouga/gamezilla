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
import { deadlineApp } from './app';

/** Deadline system: Schedule expire under partition. */
export const deadlineSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'room.deadline',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, deadlineApp, args),
});
deadlineSystem.host({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(deadlineSystem, deadlineApp);
