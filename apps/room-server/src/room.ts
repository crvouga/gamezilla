// @io-wall-ok — Room server Worker composition root (Durable Object isolate).

import { createRoomServerDurableObject } from './app/create-room-server-durable-object';
import { wallRoomServerEnv } from './app/wall-room-server-env';

const env = wallRoomServerEnv();

export const RoomServerDurableObject = createRoomServerDurableObject(env);

/** Minimal fetch so the Worker script boots; clients reach rooms via API gateway. */
export default {
  async fetch(): Promise<Response> {
    return new Response('room server worker', { status: 200 });
  },
};
