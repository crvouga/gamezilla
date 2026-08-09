// @io-wall-ok
import type { Clock, Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { CreateId, Random } from '@pkgs/uuid';

import type { Io } from './types';

export type SimClock = Clock & {
  readonly advance: (ms: number) => void;
  readonly set: (ms: number) => void;
};

export type SimIo = Io & {
  readonly clock: SimClock;
};

export type CreateSimIoArgs = {
  readonly seed: number | bigint | string;
  readonly startMs?: number;
  /** Defaults to a client that rejects all fetches. */
  readonly http?: HttpClient;
};

function toSeedBigInt(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') {
    return seed === 0n ? 1n : seed & 0xffffffffffffffffn;
  }
  if (typeof seed === 'string') {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= BigInt(seed.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h === 0n ? 1n : h;
  }
  if (!Number.isFinite(seed)) return 1n;
  const asInt = BigInt(Math.floor(Math.abs(seed))) & 0xffffffffffffffffn;
  return asInt === 0n ? 1n : asInt;
}

function createMulberryRandom(seed: bigint): Random {
  let state = Number(seed & 0xffffffffn) >>> 0;
  if (state === 0) state = 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededCreateId(random: Random): CreateId {
  return () => {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(random() * 256);
    }
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

type TimerEntry = {
  readonly id: number;
  at: number;
  readonly fn: () => void;
  readonly intervalMs: number | null;
};

function createSimClockAndTimers(startMs: number): {
  readonly clock: SimClock;
  readonly timers: Timers;
} {
  let now = startMs;
  let nextId = 1;
  const entries = new Map<number, TimerEntry>();

  const flushDue = (): void => {
    for (;;) {
      let due: TimerEntry | null = null;
      for (const e of entries.values()) {
        if (e.at <= now && (due === null || e.at < due.at)) due = e;
      }
      if (due === null) break;
      if (due.intervalMs === null) {
        entries.delete(due.id);
      } else {
        due.at = now + due.intervalMs;
      }
      due.fn();
    }
  };

  const clock: SimClock = {
    now: () => now,
    advance(ms: number): void {
      if (!(ms >= 0) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.advance: bad delta ${ms}`);
      }
      now += ms;
      flushDue();
    },
    set(ms: number): void {
      if (!(ms >= now) || !Number.isFinite(ms)) {
        throw new Error(`SimClock.set: cannot go backwards (${ms} < ${now})`);
      }
      now = ms;
      flushDue();
    },
  };

  const timers: Timers = {
    setTimeout(fn, ms) {
      const id = nextId++;
      entries.set(id, {
        id,
        at: now + Math.max(0, ms),
        fn,
        intervalMs: null,
      });
      return id;
    },
    clearTimeout(handle) {
      entries.delete(handle as number);
    },
    setInterval(fn, ms) {
      const id = nextId++;
      const intervalMs = Math.max(0, ms);
      entries.set(id, {
        id,
        at: now + intervalMs,
        fn,
        intervalMs,
      });
      return id;
    },
    clearInterval(handle) {
      entries.delete(handle as number);
    },
  };

  return { clock, timers };
}

const rejectingHttp: HttpClient = {
  fetch: async () => {
    throw new Error(
      'createSimIo: http not configured — pass http in CreateSimIoArgs'
    );
  },
};

/** Deterministic {@link Io} for simulation (virtual clock + seeded rng/ids). */
export function createSimIo(args: CreateSimIoArgs): SimIo {
  const seed = toSeedBigInt(args.seed);
  const random = createMulberryRandom(seed);
  const { clock, timers } = createSimClockAndTimers(args.startMs ?? 0);
  return {
    clock,
    timers,
    createId: createSeededCreateId(random),
    random,
    http: args.http ?? rejectingHttp,
    seed,
  };
}
