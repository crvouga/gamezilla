// @io-wall-ok
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';

import type { Io } from './types';

function mintWallSeed(): bigint {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n === 0n ? 1n : n;
}

/** Production {@link Io} backed by wall clock, timers, crypto, and global fetch. */
export function wallIo(): Io {
  return {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    http: createGlobalHttpClient(),
    seed: mintWallSeed(),
  };
}
