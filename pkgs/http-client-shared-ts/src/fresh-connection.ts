import type { HttpClient } from './types';

/**
 * Sends every request on a new connection instead of an idle pooled one.
 *
 * For a client whose requests are minutes apart, such as a synthetic monitor
 * between browser steps. A middlebox can forget an idle connection without
 * closing it; Bun's `fetch` then writes the next request into it and fails
 * with `ECONNRESET` before the server ever sees it. Browsers resend in that
 * case, Bun does not, and a POST cannot safely be resent. `keepalive: false`
 * makes Bun open (and close) a connection per request.
 */
export function withFreshConnections(http: HttpClient): HttpClient {
  return {
    fetch: (input, init) => http.fetch(input, { ...init, keepalive: false }),
  };
}
