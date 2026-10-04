/** Thrown when `fetch` fails for a non-abort transport reason (DNS, offline, TLS, …). */
export class HttpNetworkError extends Error {
  override readonly name = 'HttpNetworkError';

  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
  }
}
