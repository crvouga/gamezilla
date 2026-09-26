import type { Clock, Timers } from '@pkgs/clock';

/** Manual clock + immediate-or-manual timers for deterministic engine tests. */
export function testPorts(startMs = 1_000): {
  clock: Clock & { advance: (ms: number) => void };
  timers: Timers;
  createId: () => string;
  fire: () => void;
} {
  let now = startMs;
  let seq = 0;
  const pending = new Map<number, () => void>();
  let handle = 0;
  const clock = {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
  const timers: Timers = {
    setTimeout: (fn) => {
      handle += 1;
      pending.set(handle, fn);
      return handle;
    },
    clearTimeout: (h) => {
      pending.delete(h as number);
    },
    setInterval: () => {
      throw new Error('setInterval unused in room tests');
    },
    clearInterval: () => undefined,
  } as Timers;
  return {
    clock,
    timers,
    createId: () => `id-${String(++seq)}`,
    fire: () => {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) fn();
    },
  };
}
