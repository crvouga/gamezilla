import { defineRoomSystem, type RoomSystemDef } from '../../../sim/scenario';
import { counterApp } from './app';

/** Framework-owned counter world: server + `clientCount` clients. */
export const counterSystem: RoomSystemDef = defineRoomSystem(counterApp, {
  id: 'room.counter',
});
