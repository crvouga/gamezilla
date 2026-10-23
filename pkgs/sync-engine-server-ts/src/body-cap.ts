import { PAYLOAD_TOO_LARGE } from '@pkgs/sync-engine-shared-ts/v2';
import { bodyLimit } from 'hono/body-limit';

/**
 * Refuse a sync request body over its byte cap before it is read whole. The
 * 413 names the cap, so a client can tell a batch to split from a single
 * write it can never send.
 */
export function syncBodyCap(maxBytes: number) {
  return bodyLimit({
    maxSize: maxBytes,
    onError: (c) => c.json({ error: PAYLOAD_TOO_LARGE, maxBytes }, 413),
  });
}
