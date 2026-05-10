import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '../shared';
import { useQuery } from '@gamezilla/patch-db/react';

/**
 * Count of currently-active sessions for the given device — `expiresAt`
 * later than now. Used by the device list / detail rows.
 */
export function useDeviceActiveSessionCount(deviceId: string): number {
  const enabled = deviceId.length > 0;
  const result = useQuery(
    enabled
      ? {
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          where: {
            type: '=' as const,
            attribute: AccountSessionAttr.deviceId.key,
            value: deviceId,
          },
          limit: 500,
        }
      : { entityType: ACCOUNT_SESSION_ENTITY_TYPE, limit: 0 }
  );

  let count = 0;
  const now = Date.now();
  for (const e of result.entities) {
    const token = e.attributes[AccountSessionAttr.token.key];
    const expiresAt = e.attributes[AccountSessionAttr.expiresAt.key];
    if (typeof token !== 'string' || token.length === 0) continue;
    if (typeof expiresAt !== 'string') continue;
    const t = Date.parse(expiresAt);
    if (Number.isNaN(t)) continue;
    if (t > now) count += 1;
  }
  return count;
}
