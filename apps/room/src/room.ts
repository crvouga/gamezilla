// @io-wall-ok — Room Worker composition root (Durable Object isolate).

import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/public/load-game-plugins';
import { wallClock } from '@pkgs/clock';
import { createDurableObjectAdapter } from '@pkgs/room/server/adapters/durable-object';

export const Room = createDurableObjectAdapter({
  modules: composeRoomModules(GAME_DEFINITIONS, wallClock.now),
  clock: wallClock,
  createId: () => crypto.randomUUID(),
});

/** Minimal fetch so the Worker script boots; clients reach rooms via API gateway. */
export default {
  async fetch(): Promise<Response> {
    return new Response('room worker', { status: 200 });
  },
};
