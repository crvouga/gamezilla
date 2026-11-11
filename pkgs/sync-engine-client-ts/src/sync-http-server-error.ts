/**
 * HTTP 5xx: the server failed to answer this time (a database it could not
 * reach, a node restarting). The request itself was fine, so a later attempt
 * can succeed; readers retry it with backoff instead of waiting for the next
 * reconciliation.
 */
export class SyncHttpServerError extends Error {
  override readonly name = 'SyncHttpServerError';
  readonly status: number;

  constructor(path: string, status: number, body: string) {
    super(`${path} failed (${status})${body.length > 0 ? `: ${body}` : ''}`);
    this.status = status;
  }
}
