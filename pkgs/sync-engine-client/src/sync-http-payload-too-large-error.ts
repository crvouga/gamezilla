/** HTTP 413: the request body is over the server's byte cap. Retrying the
 * same body can never succeed; the caller splits it or gives the write up. */
export class SyncHttpPayloadTooLargeError extends Error {
  override readonly name = 'SyncHttpPayloadTooLargeError';
  readonly maxBytes: number | null;

  constructor(maxBytes: number | null) {
    super(`payload_too_large:${maxBytes ?? 'unknown'}`);
    this.maxBytes = maxBytes;
  }
}
