// @io-wall-ok — Cloudflare Worker / production RoomServerEnv composition root.

import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';

import type { RoomServerEnv } from './room-server-env';

/**
 * A number in [0, 1) nobody can predict from other draws: a room deals hidden
 * hands from it, so it is the platform's cryptographic source, not
 * `Math.random`, whose state a few outputs give away.
 */
function unpredictableRandom(): number {
  const [high, low] = crypto.getRandomValues(new Uint32Array(2));
  return ((high! >>> 5) * 67108864 + (low! >>> 6)) / 9007199254740992;
}

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
    random: unpredictableRandom,
    seed: mintWallSeed(),
  };
}
