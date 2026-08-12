// @io-wall-ok — browser SPA wall HTTP for the simulation-report viewer.
/**
 * Report SPA runs in the browser against the local Bun report server.
 * Product code must not call bare `fetch`; this entry-shaped adapter is the
 * only wall boundary for viewer HTTP.
 */
export function reportFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init);
}
