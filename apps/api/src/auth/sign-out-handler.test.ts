import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
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
import { handleSignOut, parseBearerFromRequest } from './sign-out-handler';

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

const DEVICE_ID = '00000000-0000-4000-8000-000000000aaa';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000bbb';
const SESSION_ID = '00000000-0000-4000-8000-000000000ccc';
const TOKEN = 'live-bearer-token';

function seedActiveSession(db: MemoryPatchDb): void {
  db.entities.push({
    entityId: SESSION_ID,
    entityType: ACCOUNT_SESSION_ENTITY_TYPE,
    attributes: {
      [AccountSessionAttr.deviceId]: DEVICE_ID,
      [AccountSessionAttr.accountId]: ACCOUNT_ID,
      [AccountSessionAttr.token]: TOKEN,
      [AccountSessionAttr.expiresAt]: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString(),
      [AccountSessionAttr.createdAt]: new Date().toISOString(),
    },
  });
}

describe('handleSignOut', () => {
  it('returns 401 when Bearer is missing', async () => {
    const db = new MemoryPatchDb();
    const r = await handleSignOut({ db, bearer: null });
    expect(r.status).toBe(401);
  });

  it('returns 204 and clears the session token + expiresAt for the bearer', async () => {
    const db = new MemoryPatchDb();
    seedActiveSession(db);

    const r = await handleSignOut({ db, bearer: TOKEN });

    expect(r.status).toBe(204);
    const row = db.entities.find((e) => e.entityId === SESSION_ID);
    expect(row).toBeDefined();
    expect(row?.attributes[AccountSessionAttr.token]).toBeNull();
    const exp = row?.attributes[AccountSessionAttr.expiresAt];
    expect(typeof exp).toBe('string');
    expect(Date.parse(exp as string)).toBeLessThanOrEqual(Date.now());
  });

  it('is idempotent: a second sign-out for the same bearer is a 204 no-op', async () => {
    const db = new MemoryPatchDb();
    seedActiveSession(db);

    const first = await handleSignOut({ db, bearer: TOKEN });
    expect(first.status).toBe(204);

    // Token in DB is now null; subsequent call by-token finds no row.
    const second = await handleSignOut({ db, bearer: TOKEN });
    expect(second.status).toBe(204);
  });

  it('returns 204 for an unknown bearer (does not leak existence)', async () => {
    const db = new MemoryPatchDb();
    seedActiveSession(db);

    const r = await handleSignOut({ db, bearer: 'never-issued-token' });
    expect(r.status).toBe(204);
    // Existing session is left intact.
    const row = db.entities.find((e) => e.entityId === SESSION_ID);
    expect(row?.attributes[AccountSessionAttr.token]).toBe(TOKEN);
  });
});

describe('parseBearerFromRequest', () => {
  it('extracts the Bearer token', () => {
    const req = new Request('https://example.com/auth/sign-out', {
      headers: { Authorization: 'Bearer abc.def' },
    });
    expect(parseBearerFromRequest(req)).toBe('abc.def');
  });

  it('returns null when header is absent', () => {
    const req = new Request('https://example.com/auth/sign-out');
    expect(parseBearerFromRequest(req)).toBeNull();
  });

  it('returns null for non-Bearer schemes', () => {
    const req = new Request('https://example.com/auth/sign-out', {
      headers: { Authorization: 'Basic abcdef' },
    });
    expect(parseBearerFromRequest(req)).toBeNull();
  });

  it('returns null for empty Bearer value', () => {
    const req = new Request('https://example.com/auth/sign-out', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(parseBearerFromRequest(req)).toBeNull();
  });
});
