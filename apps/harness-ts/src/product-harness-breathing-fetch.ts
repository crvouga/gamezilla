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

/** Hands the thread back to the page for one turn of the event loop. */
export type HandBack = () => Promise<void>;

/**
 * A turn of the event loop that a browser does not slow down. A tab that is
 * in the background, or shown inside another app's panel, has its timers
 * held to one a second or worse; a breath on a timer then makes every
 * request take seconds, and what a person does (joining a space) is given
 * up on before the server has answered. A message between two ports is
 * delivered on the next turn whatever the tab's standing. Timers are what is
 * left where there are no ports.
 */
export function createHandBack(timers: Timers): HandBack {
  if (typeof MessageChannel === 'undefined')
    return () =>
      new Promise<void>((resolve) => {
        timers.setTimeout(resolve, 0);
      });
  const channel = new MessageChannel();
  const waiting: (() => void)[] = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  return () =>
    new Promise<void>((resolve) => {
      waiting.push(resolve);
      channel.port2.postMessage(null);
    });
}

export function createBreathe(clock: Clock, handBack: HandBack): Breathe {
  let last = clock.now();
  return async () => {
    if (clock.now() - last < BREATH_EVERY_MS) return;
    await handBack();
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
