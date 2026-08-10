// @io-wall-ok
import { classifyHttpFetchError } from './errors';
import type { HttpClient, HttpFetch } from './types';

async function wallFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await globalThis.fetch(input, init);
  } catch (err) {
    throw classifyHttpFetchError(err);
  }
}

/** Production {@link HttpClient} backed by `globalThis.fetch`. */
export function createGlobalHttpClient(): HttpClient {
  return {
    fetch: wallFetch,
  };
}

/** Bind `globalThis.fetch` as a standalone {@link HttpFetch}. */
export function globalHttpFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return wallFetch(input, init);
}

export type { HttpFetch };
