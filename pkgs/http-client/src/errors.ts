/**
 * Typed HTTP transport failures for DST parity.
 * Non-OK Response bodies stay as Response (caller checks status); these wrap
 * thrown transport failures from `fetch` (network down, abort, DNS, etc.).
 */

import { HttpAbortError } from './http-abort-error';
import { HttpNetworkError } from './http-network-error';

export { HttpAbortError } from './http-abort-error';
export { HttpNetworkError } from './http-network-error';

/** True when `err` is an abort (DOMException / AbortError / our typed class). */
export function isHttpAbortError(err: unknown): boolean {
  if (err instanceof HttpAbortError) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (
    typeof DOMException !== 'undefined' &&
    err instanceof DOMException &&
    err.name === 'AbortError'
  ) {
    return true;
  }
  return false;
}

/** Classify a thrown `fetch` failure into a typed http-client error. */
export function classifyHttpFetchError(err: unknown): Error {
  if (err instanceof HttpNetworkError || err instanceof HttpAbortError) {
    return err;
  }
  if (isHttpAbortError(err)) {
    return new HttpAbortError(
      err instanceof Error ? err.message : 'The operation was aborted',
      err
    );
  }
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'HTTP request failed';
  return new HttpNetworkError(message, err);
}
