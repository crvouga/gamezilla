// @io-wall-ok — Synthetic Population Worker process and isolated-realm composition ports.
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';

export function workerWallPorts() {
  return {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    http: async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const abort = new AbortController();
      const timer = wallTimers.setTimeout(() => abort.abort(), 5000);
      try {
        return await globalThis.fetch(input, {
          ...init,
          signal: abort.signal,
        });
      } finally {
        wallTimers.clearTimeout(timer);
      }
    },
  };
}
