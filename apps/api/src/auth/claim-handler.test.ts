import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { AuthClaimResult } from './claim-handler';
import { beforeAll, describe, expect, it, mock } from 'bun:test';
import type {
  Entity,
  PatchInput,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
  PatchesDbResult,
} from '@gamezilla/patch-db/interface';

mock.module('./google-token', () => ({
  verifyGoogleIdToken: async () => ({
    sub: 'google-sub-test',
    email: 'tester@example.com',
  }),
}));

let handleAuthClaimResult: (
  db: PatchesDb,
  body: { googleIdToken: string; principalId: string },
  options: { googleClientId?: string }
) => Promise<AuthClaimResult>;

let GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE: string;

beforeAll(async () => {
  const mod = await import('./claim-handler');
  handleAuthClaimResult = mod.handleAuthClaimResult;
  GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE = mod.GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE;
});

function matchWhere(entity: Entity, where: PatchesDbQueryWhereClause): boolean {
  if (where.type === 'and') {
    return where.clauses.every((c) => matchWhere(entity, c));
  }
  if (where.type === '=') {
    return entity.attributes[where.attribute] === where.value;
  }
  return false;
}

function executeQuery(entities: Entity[], q: PatchesDbQuery): Entity[] {
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

class MemoryPatchesDb implements PatchesDb {
  private entities: Entity[] = [];

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return queries.map((query) => {
      const entities = executeQuery(this.entities, query);
      return {
        query,
        entities,
        patches: [],
        total: entities.length,
        hasMore: false,
        nextCursor: null,
      };
    });
  }

  async write(patches: PatchInput[]): Promise<never[]> {
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
          throw new Error('MemoryPatchesDb: missing entity during merge');
        }
        this.entities[idx] = {
          ...prev,
          attributes: { ...prev.attributes, ...p.attributes },
        };
      }
    }
    return [];
  }

  async update(): Promise<void> {}
}

describe('handleAuthClaimResult', () => {
  it('returns 503 when Google client id is not configured', async () => {
    const db = new MemoryPatchesDb();
    const r = await handleAuthClaimResult(
      db,
      { googleIdToken: 'any', principalId: '00000000-0000-4000-8000-000000000001' },
      {}
    );
    expect(r.status).toBe(503);
    if (r.status === 503) {
      expect(r.json.error).toBe(GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE);
    }
  });

  it('creates account and session on first successful claim', async () => {
    const db = new MemoryPatchesDb();
    const principalId = '00000000-0000-4000-8000-0000000000aa';
    const r = await handleAuthClaimResult(
      db,
      { googleIdToken: 'fake-token', principalId },
      { googleClientId: 'web-client-id.apps.googleusercontent.com' }
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
              attribute: AccountProviderAttr.providerAccountId,
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

  it('reuses same accountId for same Google sub on a second device principal', async () => {
    const db = new MemoryPatchesDb();
    const principalA = '00000000-0000-4000-8000-0000000000a1';
    const principalB = '00000000-0000-4000-8000-0000000000b2';
    const opts = { googleClientId: 'web-client-id.apps.googleusercontent.com' };

    const r1 = await handleAuthClaimResult(
      db,
      { googleIdToken: 't1', principalId: principalA },
      opts
    );
    expect(r1.status).toBe(200);
    if (r1.status !== 200) return;
    const accountId1 = r1.json.accountId;

    const r2 = await handleAuthClaimResult(
      db,
      { googleIdToken: 't2', principalId: principalB },
      opts
    );
    expect(r2.status).toBe(200);
    if (r2.status !== 200) return;
    expect(r2.json.accountId).toBe(accountId1);

    const readPrincipalB = await db.read([
      { entityType: PRINCIPAL_ENTITY_TYPE, entityId: principalB, limit: 1 },
    ]);
    const pB = readPrincipalB[0];
    expect(pB).toBeDefined();
    if (pB === undefined) return;
    const ent = pB.entities[0];
    expect(ent).toBeDefined();
    if (ent === undefined) return;
    expect(ent.attributes['principal/accountId']).toBe(accountId1);
  });

  it('rebinds the principal to the new account when previously bound to a different account', async () => {
    const db = new MemoryPatchesDb();
    const principalId = '00000000-0000-4000-8000-00000000c001';
    const staleAccount = '00000000-0000-4000-8000-00000000d001';
    await db.write([
      {
        entityId: principalId,
        entityType: PRINCIPAL_ENTITY_TYPE,
        attributes: {
          [PrincipalAttr.accountId]: staleAccount,
        },
      },
    ]);

    const r = await handleAuthClaimResult(
      db,
      { googleIdToken: 't', principalId },
      { googleClientId: 'web-client-id.apps.googleusercontent.com' }
    );
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.json.accountId).not.toBe(staleAccount);

    const readPrincipal = await db.read([
      { entityType: PRINCIPAL_ENTITY_TYPE, entityId: principalId, limit: 1 },
    ]);
    const p = readPrincipal[0];
    expect(p).toBeDefined();
    if (p === undefined) return;
    const ent = p.entities[0];
    expect(ent).toBeDefined();
    if (ent === undefined) return;
    expect(ent.attributes['principal/accountId']).toBe(r.json.accountId);
  });
});
