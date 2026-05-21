/**
 * Thrown by HTTP patch-db transports when the server responds with 401 or 403.
 * {@link SyncPatchDb} uses this to mark patches as rejected instead of retrying forever.
 */
export class PatchDbTransportRejectedError extends Error {
  override readonly name = 'PatchDbTransportRejectedError';

  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
  }
}
