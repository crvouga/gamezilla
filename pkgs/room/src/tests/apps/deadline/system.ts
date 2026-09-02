import { defineRoomSystem, type RoomSystemDef } from '../../../sim/scenario';
import { deadlineApp } from './app';

/** Framework-owned deadline world: Schedule expire under partition. */
export const deadlineSystem: RoomSystemDef = defineRoomSystem(deadlineApp, {
  id: 'room.deadline',
});
