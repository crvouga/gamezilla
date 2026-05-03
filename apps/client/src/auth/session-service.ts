import {
  assertDeviceId,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { DeviceService } from './device-service';

export type AccountSessionRecord = {
  entityId: string;
  deviceId: string;
  accountId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export interface SessionService {
  /** Last {@link refresh} result; call {@link refresh} after writes. */
  getSession(): AccountSessionRecord | null;
  isAuthenticated(): boolean;
  /** Re-reads PatchDB for the active non-expired session for this device. */
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
  expectedDeviceId: string
): AccountSessionRecord | null {
  const deviceId = entity.attributes[AccountSessionAttr.deviceId];
  const accountId = entity.attributes[AccountSessionAttr.accountId];
  const token = entity.attributes[AccountSessionAttr.token];
  const expiresAt = entity.attributes[AccountSessionAttr.expiresAt];
  const createdAt = entity.attributes[AccountSessionAttr.createdAt];

  if (deviceId !== expectedDeviceId) {
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
    deviceId: String(deviceId),
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

async function readLatestSessionEntity(
  db: PatchDb,
  deviceId: string,
  limit: number
) {
  const [result] = await db.read([
    {
      entityType: ACCOUNT_SESSION_ENTITY_TYPE,
      where: {
        type: '=',
        attribute: AccountSessionAttr.deviceId,
        value: deviceId,
      },
      orderBy: [{ attribute: AccountSessionAttr.createdAt, direction: 'desc' }],
      limit,
    },
  ]);
  return result?.entities ?? [];
}

async function loadActiveSession(
  db: PatchDb,
  deviceId: string
): Promise<AccountSessionRecord | null> {
  const entities = await readLatestSessionEntity(db, deviceId, 50);
  for (const entity of entities) {
    const parsed = parseSessionEntity(entity, deviceId);
    if (parsed === null) continue;
    if (isExpired(parsed.expiresAt)) continue;
    return parsed;
  }
  return null;
}

async function clearAllActiveSessions(
  db: PatchDb,
  deviceId: string
): Promise<void> {
  // Must clear every non-expired entity for the device: clearing only the
  // latest leaves older active sessions which `loadActiveSession` would
  // resurrect on the next refresh, leaving the user signed in.
  const entities = await readLatestSessionEntity(db, deviceId, 50);
  const epoch = new Date(0).toISOString();
  const writes = entities
    .map((entity) => parseSessionEntity(entity, deviceId))
    .filter((parsed): parsed is AccountSessionRecord => parsed !== null)
    .filter((parsed) => !isExpired(parsed.expiresAt))
    .map((parsed) => ({
      entityId: parsed.entityId,
      entityType: ACCOUNT_SESSION_ENTITY_TYPE,
      attributes: {
        [AccountSessionAttr.token]: null,
        [AccountSessionAttr.expiresAt]: epoch,
      },
    }));
  if (writes.length === 0) return;
  await db.write(writes);
}

export function createSessionService(
  db: PatchDb,
  deviceService: DeviceService
): SessionService {
  let cached: AccountSessionRecord | null = null;

  return {
    getSession(): AccountSessionRecord | null {
      const s = cached;
      if (s === null) return null;
      if (isExpired(s.expiresAt)) return null;
      return s;
    },

    isAuthenticated(): boolean {
      const s = cached;
      if (s === null) return false;
      return !isExpired(s.expiresAt);
    },

    async refresh(): Promise<void> {
      const deviceId = deviceService.getDeviceId();
      assertDeviceId(deviceId);
      cached = await loadActiveSession(db, deviceId);
    },

    async clearSession(): Promise<void> {
      const deviceId = deviceService.getDeviceId();
      assertDeviceId(deviceId);
      await clearAllActiveSessions(db, deviceId);
      cached = null;
    },
  };
}
