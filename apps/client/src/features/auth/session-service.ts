import {
  assertPrincipalId,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/principal-id';
import { assert } from '@gamezilla/lib/assert';
import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import type { PrincipalService } from './principal-service';

export type PrincipalSessionRecord = {
  entityId: string;
  principalId: string;
  accountId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export interface SessionService {
  /** Last {@link refresh} result; call {@link refresh} after writes. */
  getSession(): PrincipalSessionRecord | null;
  isAuthenticated(): boolean;
  /** Re-reads PatchDB for the active non-expired session for this principal. */
  refresh(): Promise<void>;
  clearSession(): Promise<void>;
}

export const SessionServiceToken: InjectionToken<SessionService> =
  Symbol('SessionService');

function parseSessionEntity(
  entity: {
    entityId: string;
    attributes: Record<string, unknown>;
  },
  expectedPrincipalId: string
): PrincipalSessionRecord | null {
  const principalId = entity.attributes[PrincipalSessionAttr.principalId];
  const accountId = entity.attributes[PrincipalSessionAttr.accountId];
  const token = entity.attributes[PrincipalSessionAttr.token];
  const expiresAt = entity.attributes[PrincipalSessionAttr.expiresAt];
  const createdAt = entity.attributes[PrincipalSessionAttr.createdAt];

  if (principalId !== expectedPrincipalId) {
    return null;
  }
  if (
    typeof accountId !== 'string' ||
    typeof token !== 'string' ||
    token.length === 0 ||
    typeof expiresAt !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null;
  }

  assertUuid(accountId, 'session accountId must be UUID');
  return {
    entityId: entity.entityId,
    principalId: String(principalId),
    accountId,
    token,
    expiresAt,
    createdAt,
  };
}

function isExpired(iso: string): boolean {
  const t = Date.parse(iso);
  assert.ok(!Number.isNaN(t), 'expiresAt must be parseable ISO date', { iso });
  return t <= Date.now();
}

export function createSessionService(
  db: PatchesDb,
  principalService: PrincipalService
): SessionService {
  let cached: PrincipalSessionRecord | null = null;

  async function refresh(): Promise<void> {
    const principalId = principalService.getPrincipalId();
    assertPrincipalId(principalId);

    const [result] = await db.read([
      {
        entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: PrincipalSessionAttr.principalId,
          value: principalId,
        },
        orderBy: [
          { attribute: PrincipalSessionAttr.createdAt, direction: 'desc' },
        ],
        limit: 50,
      },
    ]);

    let best: PrincipalSessionRecord | null = null;
    for (const entity of result?.entities ?? []) {
      const parsed = parseSessionEntity(entity, principalId);
      if (parsed === null) {
        continue;
      }
      if (isExpired(parsed.expiresAt)) {
        continue;
      }
      best = parsed;
      break;
    }
    cached = best;
  }

  return {
    getSession(): PrincipalSessionRecord | null {
      const s = cached;
      if (s === null) {
        return null;
      }
      if (isExpired(s.expiresAt)) {
        return null;
      }
      return s;
    },

    isAuthenticated(): boolean {
      const s = cached;
      if (s === null) {
        return false;
      }
      return !isExpired(s.expiresAt);
    },

    refresh,

    async clearSession(): Promise<void> {
      const principalId = principalService.getPrincipalId();
      assertPrincipalId(principalId);

      const [result] = await db.read([
        {
          entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
          where: {
            type: '=',
            attribute: PrincipalSessionAttr.principalId,
            value: principalId,
          },
          orderBy: [
            { attribute: PrincipalSessionAttr.createdAt, direction: 'desc' },
          ],
          limit: 1,
        },
      ]);

      const entity = result?.entities[0];
      if (entity === undefined) {
        cached = null;
        return;
      }

      await db.write([
        {
          entityId: entity.entityId,
          entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
          attributes: {
            [PrincipalSessionAttr.token]: null,
            [PrincipalSessionAttr.expiresAt]: new Date(0).toISOString(),
          },
        },
      ]);
      cached = null;
    },
  };
}
