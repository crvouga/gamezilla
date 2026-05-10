import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '../shared';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';

function activeExpiryMs(entity: Entity, now: number): number | null {
  const token = entity.attributes[AccountSessionAttr.token.key];
  const expiresAt = entity.attributes[AccountSessionAttr.expiresAt.key];
  if (typeof token !== 'string' || token.length === 0) return null;
  if (typeof expiresAt !== 'string') return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  return t > now ? t : null;
}

function pickLatestActiveExpiryMs(
  entities: readonly Entity[],
  now: number
): number | null {
  let max: number | null = null;
  for (const e of entities) {
    const t = activeExpiryMs(e, now);
    if (t === null) continue;
    if (max === null || t > max) max = t;
  }
  return max;
}

/**
 * ISO `expiresAt` of the latest active session row for `deviceId`, or `null`
 * when none exist.
 */
export function useDeviceLatestSessionExpiresAt(
  deviceId: string
): string | null {
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

  const max = pickLatestActiveExpiryMs(result.entities, Date.now());
  return max === null ? null : new Date(max).toISOString();
}
