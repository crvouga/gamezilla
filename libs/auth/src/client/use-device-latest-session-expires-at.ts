import {
  AccountSessionCol,
  ACCOUNT_SESSIONS_TABLE,
} from '../shared/auth-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type SessionRow = {
  readonly token: string | null;
  readonly expires_at: string | null;
};

function activeExpiryMs(row: SessionRow, now: number): number | null {
  const token = row.token;
  const expiresAt = row.expires_at;
  if (typeof token !== 'string' || token.length === 0) return null;
  if (typeof expiresAt !== 'string') return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  return t > now ? t : null;
}

function pickLatestActiveExpiryMs(
  rows: readonly SessionRow[],
  now: number
): number | null {
  let max: number | null = null;
  for (const row of rows) {
    const t = activeExpiryMs(row, now);
    if (t === null) continue;
    if (max === null || t > max) max = t;
  }
  return max;
}

/**
 * ISO `expires_at` of the latest active session row for `deviceId`, or `null`
 * when none exist.
 */
export function useDeviceLatestSessionExpiresAt(
  deviceId: string
): string | null {
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

  const max = pickLatestActiveExpiryMs(rows, Date.now());
  return max === null ? null : new Date(max).toISOString();
}
