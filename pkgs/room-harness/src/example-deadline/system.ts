import { defineSystem } from '@pkgs/harness';
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomHarness,
  roomSystemCatalog,
} from '../scenario';
import { deadlineApp } from './app';

/** Deadline system: Schedule expire under partition. */
export const deadlineSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.deadline',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, deadlineApp, args),
  ...roomSystemCatalog(deadlineApp),
});
