import { defineRoomSystem, type RoomSystemDef } from '../../../sim/scenario';
import { deadlineApp } from './app';

/** Framework-owned deadline system: Schedule expire under partition. */
export const deadlineSystem: RoomSystemDef = defineRoomSystem(deadlineApp, {
  name: 'room.deadline',
});
