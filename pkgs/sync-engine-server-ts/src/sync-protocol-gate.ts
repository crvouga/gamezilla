import type { AuthErrorBody } from '@pkgs/sync-engine-shared-ts/v2';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';

/**
 * Reject pre-cut clients. `upgrade_required` must NOT wipe local DB
 * (distinct from `revoked`).
 */
export function assertSyncProtocol(request: Request): AuthErrorBody | null {
  const header = request.headers.get(SYNC_PROTOCOL_HEADER);
  const version = header !== null ? Number(header) : NaN;
  if (version === SYNC_PROTOCOL_VERSION) return null;
  return { error: 'auth', reason: 'upgrade_required' };
}
