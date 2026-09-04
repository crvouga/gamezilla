import { defineSystem } from '@pkgs/sim';
import {
  bootRoomSim,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomSim,
  roomSystemCatalog,
} from '../scenario';
import { deadlineApp } from './app';

/** Deadline system: Schedule expire under partition. */
export const deadlineSystem = defineSystem<RoomSim, RoomArgs>({
  name: 'room.deadline',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomSim(session, deadlineApp, args),
  ...roomSystemCatalog(deadlineApp),
});
