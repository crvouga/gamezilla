/** Thrown when an HTTP request is aborted (AbortSignal / AbortError). */
export class HttpAbortError extends Error {
  override readonly name = 'HttpAbortError';

  constructor(
    message = 'The operation was aborted',
    override readonly cause?: unknown
  ) {
    super(message);
  }
}
