import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomFaultProfile } from '@pkgs/room-root-harness-ts/network';

type Timers = Session['ports']['timers'];

/**
 * How a device and its network behave while a live game plays on it: a
 * realtime probe's only knobs. Every delay is drawn from the session's
 * seeded random stream, so a seed replays the same device exactly.
 */
export type RealtimeDeviceProfile = {
  /** Delivery between each device and the room. */
  readonly network: RoomFaultProfile;
  /** How long the device's own storage takes to keep one live court, at most. */
  readonly storageMs: number;
  /** How late a browser timer fires past its due time, at most (timers are not tied to the display). */
  readonly timerLateMs: number;
  /** Display refresh. */
  readonly displayHz: number;
  /** Virtual seconds measured after a one second warm-up. */
  readonly seconds: number;
};

/** Browser timers: due at a whole millisecond, then late by up to `lateMs`, never aligned to the display. */
export function browserTimers(
  timers: Timers,
  random: () => number,
  lateMs: number
): Timers {
  return {
    ...timers,
    setTimeout: (fn, ms) =>
      timers.setTimeout(fn, Math.ceil(ms) + random() * lateMs),
  };
}

export type DisplayFrames = ReturnType<typeof displayFrames>;

/** The display's own frame callback: every vsync, exactly on time. */
export function displayFrames(timers: Timers, now: () => number, hz: number) {
  const interval = 1000 / hz;
  const callbacks = new Map<number, (at: number) => void>();
  let next = 0;
  let index = Math.ceil(now() / interval);
  let handle: unknown = null;
  const listeners = new Set<(at: number) => void>();
  const vsync = () => {
    const at = now();
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const callback of due) callback(at);
    for (const listener of listeners) listener(at);
    index += 1;
    handle = timers.setTimeout(vsync, index * interval - now());
  };
  handle = timers.setTimeout(vsync, index * interval - now());
  return {
    requestAnimationFrame: (callback: (at: number) => void) => {
      callbacks.set(++next, callback);
      return next;
    },
    cancelAnimationFrame: (id: number) => {
      callbacks.delete(id);
    },
    /** Read what the screen shows, after every frame callback ran. */
    onVsync: (listener: (at: number) => void) => listeners.add(listener),
    stop: () => timers.clearTimeout(handle),
  };
}

/** A device's room whose own storage takes up to `storageMs` to keep each live court. */
export function slowLiveStorage<
  R extends { saveLiveCheckpoint: (payload: never) => Promise<boolean> },
>(room: R, session: Session, storageMs: number): R {
  return new Proxy(room, {
    get(target, key) {
      const value = Reflect.get(target, key, target) as unknown;
      if (key === 'saveLiveCheckpoint')
        return (payload: Parameters<R['saveLiveCheckpoint']>[0]) =>
          new Promise<boolean>((resolve, reject) => {
            session.ports.timers.setTimeout(() => {
              room.saveLiveCheckpoint(payload).then(resolve, reject);
            }, session.ports.random() * storageMs);
          });
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export type Percentiles = {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  readonly count: number;
};

export function percentiles(values: readonly number[]): Percentiles {
  if (values.length === 0)
    return {
      p50: Number.NaN,
      p95: Number.NaN,
      p99: Number.NaN,
      max: Number.NaN,
      count: 0,
    };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.at(-1)!),
    count: sorted.length,
  };
}

/**
 * A 60 Hz display on the session's virtual time, for a presentation whose
 * probe does not watch the screen: each requested frame runs at the next
 * refresh, and nothing is scheduled while no frame is requested.
 */
export function virtualFrames(time: {
  readonly clock: { readonly now: () => number };
  readonly timers: Timers;
}) {
  const interval = 1000 / 60;
  const callbacks = new Map<number, (at: number) => void>();
  let next = 0;
  let timer: unknown = null;
  const refresh = () => {
    timer = null;
    const due = [...callbacks.values()];
    callbacks.clear();
    const at = time.clock.now();
    for (const callback of due) callback(at);
  };
  return {
    requestAnimationFrame: (callback: (at: number) => void) => {
      callbacks.set(++next, callback);
      if (timer === null) {
        const now = time.clock.now();
        const at = (Math.floor(now / interval) + 1) * interval;
        timer = time.timers.setTimeout(refresh, at - now);
      }
      return next;
    },
    cancelAnimationFrame: (handle: number) => {
      callbacks.delete(handle);
      if (callbacks.size === 0 && timer !== null) {
        time.timers.clearTimeout(timer);
        timer = null;
      }
    },
  };
}
