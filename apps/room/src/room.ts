// @io-wall-ok — Room Worker composition root (Durable Object isolate).

import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/shared/load-game-plugins';
import { wallIo } from '@pkgs/io';
import { createDurableObjectAdapter } from '@pkgs/room/server/adapters/durable-object';

const roomIo = wallIo();

export const Room = createDurableObjectAdapter({
  modules: composeRoomModules(GAME_DEFINITIONS, roomIo.clock.now),
  clock: roomIo.clock,
  createId: roomIo.createId,
});

/** Minimal fetch so the Worker script boots; clients reach rooms via API gateway. */
export default {
  async fetch(): Promise<Response> {
    return new Response('room worker', { status: 200 });
  },
};
