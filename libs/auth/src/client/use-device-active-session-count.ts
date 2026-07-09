import {
  AccountSessionCol,
  ACCOUNT_SESSIONS_TABLE,
} from '../shared/auth-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type SessionRow = {
  readonly token: string | null;
  readonly expires_at: string | null;
};

/**
 * Count of currently-active sessions for the given device — `expires_at`
 * later than now. Used by the device list / detail rows.
 */
export function useDeviceActiveSessionCount(deviceId: string): number {
  const enabled = deviceId.length > 0;
  const { rows } = useWatchQuery<SessionRow>(
    enabled
      ? `SELECT ${AccountSessionCol.token} AS token, ${AccountSessionCol.expiresAt} AS expires_at
         FROM ${ACCOUNT_SESSIONS_TABLE.tableName}
         WHERE ${AccountSessionCol.deviceId} = ?
         LIMIT 500`
      : `SELECT ${AccountSessionCol.token} AS token, ${AccountSessionCol.expiresAt} AS expires_at
         FROM ${ACCOUNT_SESSIONS_TABLE.tableName} WHERE 0`,
    enabled ? [deviceId] : []
  );

  let count = 0;
  const now = Date.now();
  for (const row of rows) {
    const token = row.token;
    const expiresAt = row.expires_at;
    if (typeof token !== 'string' || token.length === 0) continue;
    if (typeof expiresAt !== 'string') continue;
    const t = Date.parse(expiresAt);
    if (Number.isNaN(t)) continue;
    if (t > now) count += 1;
  }
  return count;
}
