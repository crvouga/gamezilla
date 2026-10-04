// @io-wall-ok — Cloudflare Worker / production RoomServerEnv composition root.

import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';

import type { RoomServerEnv } from './room-server-env';

function mintWallSeed(): bigint {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n === 0n ? 1n : n;
}

/**
 * Production RoomServerEnv. Call only from the room-server Worker composition root.
 */
export function wallRoomServerEnv(): RoomServerEnv {
  return {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    seed: mintWallSeed(),
  };
}
