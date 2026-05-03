import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/domain/auth';
import { PatchDbHookRegistry } from '@gamezilla/patch-db/hook-registry';
import type {
  Entity,
  PatchDb,
  PatchDbCompactionResult,
  PatchDbContext,
  PatchDbQuery,
  PatchDbQueryWhereClause,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '@gamezilla/patch-db/interface';
import { describe, expect, it } from 'bun:test';
import {
  GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE,
  handleAuthClaimResult,
  type VerifyGoogleIdTokenFn,
} from './claim-handler';

const GOOGLE_WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';

const verifyFirstClaim: VerifyGoogleIdTokenFn = () =>
  Promise.resolve({
    sub: 'google-sub-test',
    email: 'tester@example.com',
  });

const verifySharedSub: VerifyGoogleIdTokenFn = () =>
  Promise.resolve({
    sub: 'google-sub-shared',
    email: 'shared@example.com',
  });

const verifyRebind: VerifyGoogleIdTokenFn = () =>
  Promise.resolve({
    sub: 'google-sub-rebind',
    email: 'rebind@example.com',
  });

function matchWhere(entity: Entity, where: PatchDbQueryWhereClause): boolean {
  if (where.type === 'and') {
    return where.clauses.every((c) => matchWhere(entity, c));
  }
  if (where.type === '=') {
    return entity.attributes[where.attribute] === where.value;
  }
  return false;
}

function executeQuery(entities: Entity[], q: PatchDbQuery): Entity[] {
  const list = entities.filter((e) => {
    if (q.entityType !== undefined && e.entityType !== q.entityType) {
      return false;
    }
    if (q.entityId !== undefined) {
      const ids = Array.isArray(q.entityId) ? q.entityId : [q.entityId];
      if (!ids.includes(e.entityId)) return false;
    }
    if (q.where !== undefined && !matchWhere(e, q.where)) return false;
    return true;
  });
  const limit = q.limit ?? list.length;
  return list.slice(0, limit);
}

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

  private entities: Entity[] = [];

  read(
    queries: PatchDbQuery[],
    _ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    void _ctx;
    return Promise.resolve(
      queries.map((query) => {
        const entities = executeQuery(this.entities, query);
        return {
          query,
          entities,
          patches: [],
          total: entities.length,
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
        if (prev === undefined) {
          throw new Error('MemoryPatchDb: missing entity during merge');
        }
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

describe('handleAuthClaimResult', () => {
  it('returns 503 when Google client id is not configured', async () => {
    const db = new MemoryPatchDb();
    const r = await handleAuthClaimResult(
      db,
      {
        googleIdToken: 'any',
        deviceId: '00000000-0000-4000-8000-000000000001',
      },
      {}
    );
    expect(r.status).toBe(503);
    if (r.status === 503) {
      expect(r.json.error).toBe(GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE);
    }
  });

  it('creates account and session on first successful claim', async () => {
    const db = new MemoryPatchDb();
    const deviceId = '00000000-0000-4000-8000-0000000000aa';
    const r = await handleAuthClaimResult(
      db,
      { googleIdToken: 'fake-token', deviceId },
      {
        googleClientId: GOOGLE_WEB_CLIENT_ID,
        verifyGoogleIdToken: verifyFirstClaim,
      }
    );
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    const accountId = r.json.accountId;
    expect(accountId.length).toBeGreaterThan(0);

    const readAccounts = await db.read([
      { entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId, limit: 1 },
    ]);
    const accounts = readAccounts[0];
    expect(accounts).toBeDefined();
    if (accounts === undefined) return;
    expect(accounts.entities.length).toBe(1);

    const readProviders = await db.read([
      {
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            {
              type: '=',
              attribute: AccountProviderAttr.provider,
              value: GOOGLE_PROVIDER,
            },
            {
              type: '=',
              attribute: AccountProviderAttr.providerUserId,
              value: 'google-sub-test',
            },
          ],
        },
        limit: 1,
      },
    ]);
    const providers = readProviders[0];
    expect(providers).toBeDefined();
    if (providers === undefined) return;
    expect(providers.entities.length).toBe(1);
  });

  it('reuses same accountId for same Google sub on a second device', async () => {
    const db = new MemoryPatchDb();
    const deviceA = '00000000-0000-4000-8000-0000000000a1';
    const deviceB = '00000000-0000-4000-8000-0000000000b2';
    const opts = {
      googleClientId: GOOGLE_WEB_CLIENT_ID,
      verifyGoogleIdToken: verifySharedSub,
    };

    const r1 = await handleAuthClaimResult(
      db,
      { googleIdToken: 't1', deviceId: deviceA },
      opts
    );
    expect(r1.status).toBe(200);
    if (r1.status !== 200) return;
    const accountId1 = r1.json.accountId;

    const r2 = await handleAuthClaimResult(
      db,
      { googleIdToken: 't2', deviceId: deviceB },
      opts
    );
    expect(r2.status).toBe(200);
    if (r2.status !== 200) return;
    expect(r2.json.accountId).toBe(accountId1);

    const readDeviceB = await db.read([
      { entityType: DEVICE_ENTITY_TYPE, entityId: deviceB, limit: 1 },
    ]);
    const pB = readDeviceB[0];
    expect(pB).toBeDefined();
    if (pB === undefined) return;
    const ent = pB.entities[0];
    expect(ent).toBeDefined();
    if (ent === undefined) return;
    expect(ent.attributes['device/accountId']).toBe(accountId1);
  });

  it('rebinds the device to the new account when previously bound to a different account', async () => {
    const db = new MemoryPatchDb();
    const deviceId = '00000000-0000-4000-8000-00000000c001';
    const staleAccount = '00000000-0000-4000-8000-00000000d001';
    await db.write([
      {
        entityId: deviceId,
        entityType: DEVICE_ENTITY_TYPE,
        attributes: {
          [DeviceAttr.accountId]: staleAccount,
        },
      },
    ]);

    const r = await handleAuthClaimResult(
      db,
      { googleIdToken: 't', deviceId },
      {
        googleClientId: GOOGLE_WEB_CLIENT_ID,
        verifyGoogleIdToken: verifyRebind,
      }
    );
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.json.accountId).not.toBe(staleAccount);

    const readDevice = await db.read([
      { entityType: DEVICE_ENTITY_TYPE, entityId: deviceId, limit: 1 },
    ]);
    const p = readDevice[0];
    expect(p).toBeDefined();
    if (p === undefined) return;
    const ent = p.entities[0];
    expect(ent).toBeDefined();
    if (ent === undefined) return;
    expect(ent.attributes['device/accountId']).toBe(r.json.accountId);
  });
});
