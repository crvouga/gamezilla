/**
 * In-process HTTP helpers for Hono-backed simulations.
 *
 * Serialize overlapping fetches (SQLite under React/Jest hangs otherwise) and
 * divert matching wall-fetch URLs into an injected HttpClient. Callers bind
 * get/set to `globalThis.fetch` at a composition root (e.g. test harness).
 */

import type { HttpClient } from '@pkgs/http-client';

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Serialize in-process Hono fetches. Overlapping SQLite work under the
 * React/Jest zone hangs; sequential requests succeed.
 *
 * Re-entrant fetch (a handler/plugin calling fetch while one is already
 * in-flight on this client) must NOT wait on `chain` — that deadlocks
 * nested auth calls (signUp → getSession).
 */
export function createSerializedHttp(rawHttp: HttpClient): HttpClient {
  let chain: Promise<unknown> = Promise.resolve();
  let active = 0;
  return {
    fetch(input, init) {
      if (active > 0) {
        active += 1;
        return rawHttp.fetch(input, init).finally(() => {
          active -= 1;
        });
      }
      const next = chain.then(async () => {
        active += 1;
        try {
          return await rawHttp.fetch(input, init);
        } finally {
          active -= 1;
        }
      });
      chain = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}

type WallFetch = typeof fetch;

/**
 * Divert matching URLs from the wall fetch into `http`. Returns a restore
 * function. Use when libraries still reach wall fetch (e.g. Better Auth).
 *
 * Callers supply get/set so this module never reads/writes `globalThis.fetch`.
 */
export function installSimGlobalFetch(args: {
  readonly http: HttpClient;
  readonly isSimUrl: (url: string) => boolean;
  readonly getFetch: () => WallFetch;
  readonly setFetch: (next: WallFetch) => void;
}): () => void {
  const previous = args.getFetch().bind(globalThis);
  args.setFetch(((input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input);
    if (args.isSimUrl(url)) {
      return args.http.fetch(input, init);
    }
    return previous(input, init);
  }) as WallFetch);
  return () => {
    args.setFetch(previous);
  };
}
