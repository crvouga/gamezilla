import {
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

export type PrincipalSessionAggregate = {
  active: number;
  latestExpiresAt: string | null;
};

function isSessionActive(entity: Entity): boolean {
  const token = entity.attributes[PrincipalSessionAttr.token];
  const expiresAt = entity.attributes[PrincipalSessionAttr.expiresAt];
  if (typeof token !== 'string' || token.length === 0) return false;
  if (typeof expiresAt !== 'string') return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

function readPrincipalId(entity: Entity): string | null {
  const v = entity.attributes[PrincipalSessionAttr.principalId];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readExpiresAt(entity: Entity): string | null {
  const v = entity.attributes[PrincipalSessionAttr.expiresAt];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Active session counts and latest expiry per principal id.
 */
export function useSessionsForPrincipals(principalIds: string[]): {
  sessionsByPrincipal: Map<string, PrincipalSessionAggregate>;
  loading: boolean;
} {
  const sortedUniqueIds = useMemo(
    () => [...new Set(principalIds)].sort(),
    [principalIds]
  );

  const query = useMemo(
    () =>
      sortedUniqueIds.length === 0
        ? { entityType: PRINCIPAL_SESSION_ENTITY_TYPE, limit: 0 }
        : {
            entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
            where: {
              type: 'in' as const,
              attribute: PrincipalSessionAttr.principalId,
              values: sortedUniqueIds,
            },
            limit: 500,
          },
    [sortedUniqueIds]
  );

  const result = useEntities(query);

  const sessionsByPrincipal = useMemo(() => {
    const byPrincipal = new Map<
      string,
      { active: number; expiries: number[] }
    >();

    for (const e of result.entities) {
      const pid = readPrincipalId(e);
      if (pid === null) continue;
      if (!isSessionActive(e)) continue;

      const cur = byPrincipal.get(pid) ?? { active: 0, expiries: [] };
      cur.active += 1;
      const exp = readExpiresAt(e);
      if (exp !== null) {
        const ms = Date.parse(exp);
        if (!Number.isNaN(ms)) cur.expiries.push(ms);
      }
      byPrincipal.set(pid, cur);
    }

    const out = new Map<string, PrincipalSessionAggregate>();
    for (const [pid, { active, expiries }] of byPrincipal) {
      const maxMs =
        expiries.length === 0 ? null : Math.max(...expiries);
      out.set(pid, {
        active,
        latestExpiresAt:
          maxMs === null ? null : new Date(maxMs).toISOString(),
      });
    }
    return out;
  }, [result.entities]);

  return { sessionsByPrincipal, loading: result.loading };
}
