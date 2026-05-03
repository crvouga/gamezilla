import { assert } from '@gamezilla/lib/assert';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import type { PatchesDb, PatchesDbVisitorContext } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '@gamezilla/patch-db/policy/system-principal';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AppAuthContext } from './default-patch-db-policies';
import { installDefaultPatchDbPolicies } from './install-default-patch-db-policies';

async function createSqliteFactory(): Promise<{
  db: PatchesDb;
  teardown: () => Promise<void>;
}> {
  const client: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await client.connect();
  const db = new PatchDbImplSqlite(client);
  await db.migrate();
  return { db, teardown: () => client.disconnect() };
}

describe('default ABAC policies (sqlite)', () => {
  let db: PatchesDb;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const r = await createSqliteFactory();
    db = r.db;
    teardown = r.teardown;
    installDefaultPatchDbPolicies(db);
  });

  afterEach(async () => {
    await teardown();
  });

  test('profile.private is scoped by entity/owner for reads', async () => {
    const accountA = '00000000-0000-4000-8000-0000000000aa';
    const accountB = '00000000-0000-4000-8000-0000000000bb';
    await db.write(
      [
        {
          entityId: 'priv-a',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountA,
            'profile/displayName': 'A',
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
        {
          entityId: 'priv-b',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountB,
            'profile/displayName': 'B',
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxA: AppAuthContext = {
      visitorId: crypto.randomUUID(),
      principalId: '00000000-0000-4000-8000-00000000a001',
      accountId: accountA,
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    };
    const [forA] = await db.read([{ entityType: 'profile.private' }], ctxA);
    assert.defined(forA, 'forA');
    expect(forA.entities.map((e) => e.entityId)).toEqual(['priv-a']);

    const ctxB: AppAuthContext = {
      visitorId: crypto.randomUUID(),
      principalId: '00000000-0000-4000-8000-00000000b002',
      accountId: accountB,
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    };
    const [forB] = await db.read([{ entityType: 'profile.private' }], ctxB);
    assert.defined(forB, 'forB');
    expect(forB.entities.map((e) => e.entityId)).toEqual(['priv-b']);
  });

  test('cross-tenant read of another account private profile is empty', async () => {
    const accountA = '00000000-0000-4000-8000-0000000000cc';
    const accountB = '00000000-0000-4000-8000-0000000000dd';
    await db.write(
      [
        {
          entityId: 'priv-x',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountA,
            'profile/displayName': 'X',
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxB: AppAuthContext = {
      visitorId: crypto.randomUUID(),
      principalId: '00000000-0000-4000-8000-00000000c003',
      accountId: accountB,
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    };
    const [forB] = await db.read(
      [{ entityType: 'profile.private', entityId: 'priv-x' }],
      ctxB
    );
    assert.defined(forB, 'forB');
    expect(forB.entities).toHaveLength(0);
  });

  test('query without entityType is denied for auth context', async () => {
    const ctx: AppAuthContext = {
      visitorId: crypto.randomUUID(),
      principalId: '00000000-0000-4000-8000-00000000e004',
      accountId: '00000000-0000-4000-8000-0000000000ee',
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    };
    const [r] = await db.read([{ on: 'patches', limit: 5 }], ctx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
    expect(r.patches).toHaveLength(0);
  });

  test('non-system write to stripe.webhook_event is forbidden', async () => {
    const ctx: AppAuthContext = {
      visitorId: crypto.randomUUID(),
      principalId: '00000000-0000-4000-8000-00000000f005',
      accountId: '00000000-0000-4000-8000-0000000000ff',
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    };
    await expect(
      db.write(
        [
          {
            entityId: 'evt_bad',
            entityType: 'stripe.webhook_event',
            attributes: {
              'entity/owner': ctx.accountId,
              'patch/createdBy': ctx.principalId,
            },
          },
        ],
        ctx
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('visitor context can read clientConfig (public)', async () => {
    await db.write(
      [
        {
          entityId: 'clientConfig__singleton',
          entityType: 'clientConfig',
          attributes: {
            'clientConfig/googleWebClientId': 'test-id',
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const visitor: PatchesDbVisitorContext = {
      visitorId: crypto.randomUUID(),
    };
    const [r] = await db.read([{ entityType: 'clientConfig' }], visitor);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(1);
    expect(r.entities[0]?.entityId).toBe('clientConfig__singleton');
  });

  test('visitor context cannot read private entities', async () => {
    await db.write(
      [
        {
          entityId: 'priv-visitor-test',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': '00000000-0000-4000-8000-0000000000aa',
            'profile/displayName': 'Private',
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const visitor: PatchesDbVisitorContext = {
      visitorId: crypto.randomUUID(),
    };
    const [r] = await db.read(
      [{ entityType: 'profile.private' }],
      visitor
    );
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
  });

  test('visitor context cannot write patches', async () => {
    const visitor: PatchesDbVisitorContext = {
      visitorId: crypto.randomUUID(),
    };
    await expect(
      db.write(
        [
          {
            entityId: 'test-entity',
            entityType: 'clientConfig',
            attributes: {
              'clientConfig/googleWebClientId': 'hacked',
              'patch/createdBy': '__hacker__',
            },
          },
        ],
        visitor
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
