import { ACCOUNT_SESSION_ENTITY_TYPE, AccountSessionAttr } from '../shared';
import { PatchDbHookRegistry } from '@gamezilla/patch-db/hook-registry';
import type {
  Entity,
  PatchDb,
  PatchDbCompactionResult,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '@gamezilla/patch-db/interface';
import { describe, expect, it } from 'bun:test';
import type { DeviceService } from './device-service';
import { createSessionService } from './session-service';

const DEVICE_ID = '00000000-0000-4000-8000-000000000aaa';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000bbb';
const SESSION_ID = '00000000-0000-4000-8000-000000000ccc';

class MemoryPatchDb implements PatchDb {
  readonly hooks = new PatchDbHookRegistry();
  readonly compaction = {
    compactEntity: (
      _key: { entityId: string; entityType: string },
      _options: { keepLatest: number },
      _ctx: PatchDbContext
    ): Promise<PatchDbCompactionResult> =>
      Promise.resolve({
        removedPatchIds: [],
        compactionPatchId: null,
      }),
    compactAll: (
      _options: { keepLatest?: number; entityType?: string },
      _ctx: PatchDbContext
    ): Promise<{ entitiesCompacted: number }> =>
      Promise.resolve({ entitiesCompacted: 0 }),
  };

  entities: Entity[] = [];
  writeCalls = 0;

  read(
    queries: PatchDbQuery[],
    _ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    void _ctx;
    return Promise.resolve(
      queries.map((query) => {
        const list = this.entities.filter((e) => {
          if (
            query.entityType !== undefined &&
            e.entityType !== query.entityType
          ) {
            return false;
          }
          if (
            query.where !== undefined &&
            query.where.type === '=' &&
            e.attributes[query.where.attribute] !== query.where.value
          ) {
            return false;
          }
          return true;
        });
        return {
          query,
          entities: list,
          patches: [],
          total: list.length,
          hasMore: false,
          nextCursor: null,
        };
      })
    );
  }

  write(
    patches: PatchInput[],
    _ctx?: PatchDbContext
  ): Promise<WritePatchesResult> {
    void _ctx;
    this.writeCalls += 1;
    for (const p of patches) {
      const idx = this.entities.findIndex(
        (e) => e.entityId === p.entityId && e.entityType === p.entityType
      );
      if (idx === -1) {
        this.entities.push({
          entityId: p.entityId,
          entityType: p.entityType,
          attributes: { ...p.attributes },
        });
      } else {
        const prev = this.entities[idx];
        if (prev === undefined) throw new Error('missing');
        this.entities[idx] = {
          ...prev,
          attributes: { ...prev.attributes, ...p.attributes },
        };
      }
    }
    return Promise.resolve({ accepted: [], rejected: [] });
  }

  update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx?: PatchDbContext
  ): Promise<void> {
    void _updates;
    void _ctx;
    return Promise.resolve();
  }
}

const fixedDevice: DeviceService = {
  getDeviceId: () => DEVICE_ID,
};

function seedActive(db: MemoryPatchDb, expiresAt = futureIso()): void {
  db.entities.push({
    entityId: SESSION_ID,
    entityType: ACCOUNT_SESSION_ENTITY_TYPE,
    attributes: {
      [AccountSessionAttr.deviceId.key]: DEVICE_ID,
      [AccountSessionAttr.accountId.key]: ACCOUNT_ID,
      [AccountSessionAttr.token.key]: 'token-abc',
      [AccountSessionAttr.expiresAt.key]: expiresAt,
      [AccountSessionAttr.createdAt.key]: new Date().toISOString(),
    },
  });
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

describe('createSessionService.clearSession (offline-friendly local revoke)', () => {
  it('clears the cached session and writes revoke patches locally', async () => {
    const db = new MemoryPatchDb();
    seedActive(db);
    const svc = createSessionService(db, fixedDevice);
    await svc.refresh();
    expect(svc.isAuthenticated()).toBe(true);

    await svc.clearSession();

    expect(svc.getSession()).toBeNull();
    expect(svc.isAuthenticated()).toBe(false);
    const row = db.entities.find((e) => e.entityId === SESSION_ID);
    expect(row?.attributes[AccountSessionAttr.token.key]).toBeNull();
    const exp = row?.attributes[AccountSessionAttr.expiresAt.key];
    expect(typeof exp).toBe('string');
    expect(Date.parse(exp as string)).toBeLessThanOrEqual(Date.now());
  });

  it('is a no-op write when no active sessions exist (offline second sign-out)', async () => {
    const db = new MemoryPatchDb();
    const svc = createSessionService(db, fixedDevice);
    await svc.refresh();

    await svc.clearSession();

    expect(db.writeCalls).toBe(0);
    expect(svc.isAuthenticated()).toBe(false);
  });

  it('revokes every active session for the device, not just the latest', async () => {
    const db = new MemoryPatchDb();
    const otherSessionId = '00000000-0000-4000-8000-000000000ddd';
    seedActive(db);
    db.entities.push({
      entityId: otherSessionId,
      entityType: ACCOUNT_SESSION_ENTITY_TYPE,
      attributes: {
        [AccountSessionAttr.deviceId.key]: DEVICE_ID,
        [AccountSessionAttr.accountId.key]: ACCOUNT_ID,
        [AccountSessionAttr.token.key]: 'token-other',
        [AccountSessionAttr.expiresAt.key]: futureIso(),
        [AccountSessionAttr.createdAt.key]: new Date(
          Date.now() - 60_000
        ).toISOString(),
      },
    });
    const svc = createSessionService(db, fixedDevice);
    await svc.refresh();

    await svc.clearSession();

    for (const id of [SESSION_ID, otherSessionId]) {
      const row = db.entities.find((e) => e.entityId === id);
      expect(row?.attributes[AccountSessionAttr.token.key]).toBeNull();
    }
  });
});
