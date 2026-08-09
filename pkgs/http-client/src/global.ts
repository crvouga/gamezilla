import type { HttpClient, HttpFetch } from './types';

/** Production {@link HttpClient} backed by `globalThis.fetch`. */
export function createGlobalHttpClient(): HttpClient {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
  };
}

/** Bind `globalThis.fetch` as a standalone {@link HttpFetch}. */
export function globalHttpFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init);
}
