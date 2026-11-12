import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';

/** How long the page may go without a chance to paint, in ms. */
const BREATH_EVERY_MS = 8;

/**
 * Lets the page paint. In one tab a request never leaves the thread: a
 * client's call, the balancer, the server and its database all finish on the
 * same turn of the event loop, and a burst of them (every client starting at
 * once) holds the thread for seconds with no frame drawn. A breath hands the
 * thread back once the system has held it for a frame's worth.
 */
export type Breathe = () => Promise<void>;

export function createBreathe(clock: Clock, timers: Timers): Breathe {
  let last = clock.now();
  return async () => {
    if (clock.now() - last < BREATH_EVERY_MS) return;
    await new Promise<void>((resolve) => {
      timers.setTimeout(resolve, 0);
    });
    last = clock.now();
  };
}

/** `fetchFn`, taking a breath on the way in and on the way out. */
export function breathingFetch(
  fetchFn: ServerHttp,
  breathe: Breathe
): ServerHttp {
  return async (input, init) => {
    await breathe();
    const response = await fetchFn(input, init);
    await breathe();
    return response;
  };
}
