import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

export type AccountSessionAggregate = {
  active: number;
  latestExpiresAt: string | null;
};

function isSessionActive(entity: Entity): boolean {
  const token = entity.attributes[AccountSessionAttr.token];
  const expiresAt = entity.attributes[AccountSessionAttr.expiresAt];
  if (typeof token !== 'string' || token.length === 0) return false;
  if (typeof expiresAt !== 'string') return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

function readDeviceId(entity: Entity): string | null {
  const v = entity.attributes[AccountSessionAttr.deviceId];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readExpiresAt(entity: Entity): string | null {
  const v = entity.attributes[AccountSessionAttr.expiresAt];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Active session counts and latest expiry per device id.
 */
export function useSessionsForDevices(deviceIds: string[]): {
  sessionsByDevice: Map<string, AccountSessionAggregate>;
} {
  const sortedUniqueIds = useMemo(
    () => [...new Set(deviceIds)].sort(),
    [deviceIds]
  );

  const query = useMemo(
    () =>
      sortedUniqueIds.length === 0
        ? { entityType: ACCOUNT_SESSION_ENTITY_TYPE, limit: 0 }
        : {
            entityType: ACCOUNT_SESSION_ENTITY_TYPE,
            where: {
              type: 'in' as const,
              attribute: AccountSessionAttr.deviceId,
              values: sortedUniqueIds,
            },
            limit: 500,
          },
    [sortedUniqueIds]
  );

  const result = useQuery(query);

  const sessionsByDevice = useMemo(() => {
    const byDevice = new Map<string, { active: number; expiries: number[] }>();

    for (const e of result.entities) {
      const did = readDeviceId(e);
      if (did === null) continue;
      if (!isSessionActive(e)) continue;

      const cur = byDevice.get(did) ?? { active: 0, expiries: [] };
      cur.active += 1;
      const exp = readExpiresAt(e);
      if (exp !== null) {
        const ms = Date.parse(exp);
        if (!Number.isNaN(ms)) cur.expiries.push(ms);
      }
      byDevice.set(did, cur);
    }

    const out = new Map<string, AccountSessionAggregate>();
    for (const [did, { active, expiries }] of byDevice) {
      const maxMs = expiries.length === 0 ? null : Math.max(...expiries);
      out.set(did, {
        active,
        latestExpiresAt: maxMs === null ? null : new Date(maxMs).toISOString(),
      });
    }
    return out;
  }, [result.entities]);

  return { sessionsByDevice };
}
