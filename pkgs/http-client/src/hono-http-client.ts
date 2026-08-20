import { classifyHttpFetchError } from './errors';
import type { HttpClient } from './types';

/**
 * Minimal shape of a Hono app: `app.fetch(request)` dispatches a `Request`
 * through the app's router in-process (no sockets).
 */
export type HonoFetchable = {
  fetch(request: Request, ...rest: unknown[]): Response | Promise<Response>;
};

export type CreateHonoHttpClientArgs = {
  readonly app: HonoFetchable;
  /** Origin used to absolutize relative URLs, e.g. `'http://sim.local'`. */
  readonly origin: string;
};

function resolveUrl(input: RequestInfo | URL, origin: string): string {
  if (typeof input === 'string') {
    return new URL(input, origin).href;
  }
  if (input instanceof URL) {
    return new URL(input.href, origin).href;
  }
  return new URL(input.url, origin).href;
}

function toRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  origin: string
): Request {
  const url = resolveUrl(input, origin);
  if (input instanceof Request) {
    // Copy method/headers/body from the source Request, applying any init overrides.
    return init === undefined
      ? new Request(url, input)
      : new Request(new Request(url, input), init);
  }
  return new Request(url, init);
}

/**
 * In-process {@link HttpClient} that dispatches requests through a Hono app.
 * Relative URLs resolve against `origin`; never opens real sockets. Use for
 * product simulations wiring the API worker into `createSimAdapters({ http })`.
 */
export function createHonoHttpClient(
  args: CreateHonoHttpClientArgs
): HttpClient {
  return {
    async fetch(input, init): Promise<Response> {
      try {
        const request = toRequest(input, init, args.origin);
        return await args.app.fetch(request);
      } catch (err) {
        throw classifyHttpFetchError(err);
      }
    },
  };
}
