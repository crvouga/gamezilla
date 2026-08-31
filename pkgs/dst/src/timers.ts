import type { Timers } from '@pkgs/clock';
import type { SimScheduler } from './scheduler';

type Handle = { readonly id: number; cancelled: boolean };

/**
 * `Timers` port backed by {@link SimScheduler} — no wall-clock `setTimeout`.
 */
export function createSimTimers(scheduler: SimScheduler): Timers {
  let nextId = 1;
  const live = new Map<number, Handle>();

  return {
    setTimeout: (fn: () => void, ms: number): unknown => {
      const handle: Handle = { id: nextId++, cancelled: false };
      live.set(handle.id, handle);
      scheduler.scheduleAfter(ms, () => {
        if (handle.cancelled) return;
        live.delete(handle.id);
        fn();
      });
      return handle;
    },
    clearTimeout: (handle: unknown): void => {
      if (handle === null || handle === undefined) return;
      const h = handle as Handle;
      if (typeof h.id !== 'number') return;
      h.cancelled = true;
      live.delete(h.id);
    },
    setInterval: (fn: () => void, ms: number): unknown => {
      const handle: Handle = { id: nextId++, cancelled: false };
      live.set(handle.id, handle);
      const tick = (): void => {
        if (handle.cancelled) return;
        fn();
        if (handle.cancelled) return;
        scheduler.scheduleAfter(ms, tick);
      };
      scheduler.scheduleAfter(ms, tick);
      return handle;
    },
    clearInterval: (handle: unknown): void => {
      if (handle === null || handle === undefined) return;
      const h = handle as Handle;
      if (typeof h.id !== 'number') return;
      h.cancelled = true;
      live.delete(h.id);
    },
  };
}
