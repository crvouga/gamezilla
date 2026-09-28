/**
 * Injectable HTTP transport. Production uses {@link createGlobalHttpClient};
 * harnesses supply an in-process dispatcher that never opens sockets.
 */
export type HttpClient = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

/** Narrow fetch signature shared with sync-engine / feature deps. */
export type HttpFetch = HttpClient['fetch'];
