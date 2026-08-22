// @io-wall-ok — Room server Worker composition root (Durable Object isolate).

import { wallClock, wallTimers } from '@pkgs/clock';

import { createRoomServerDurableObject } from './app/create-room-server-durable-object';
import type { RoomServerEnv } from './app/room-server-env';

/** DO adapter only uses clock/createId; seed is unused — no random I/O at module load. */
const env: RoomServerEnv = {
  clock: wallClock,
  timers: wallTimers,
  createId: () => crypto.randomUUID(),
  random: () => Math.random(),
  seed: 1n,
};

export const RoomServerDurableObject = createRoomServerDurableObject(env);

/** Minimal fetch so the Worker script boots; clients reach rooms via API gateway. */
export default {
  async fetch(): Promise<Response> {
    return new Response('room server worker', { status: 200 });
  },
};
