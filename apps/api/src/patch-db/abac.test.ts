import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/domain/auth';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { assert } from '@gamezilla/lib/assert';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import type {
  PatchDb,
  PatchDbClientContext,
} from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AppAuthContext } from './abac-policies';
import { installDefaultPatchDbPolicies } from './patch-db';

async function createSqliteFactory(): Promise<{
  db: PatchDb;
  teardown: () => Promise<void>;
}> {
  const client: SqlClient = SqlClientImplBunSqlite.open(':memory:');
  await client.connect();
  const db = new PatchDbImplSqlite(client);
  await db.migrate();
  return { db, teardown: () => client.disconnect() };
}

describe('default ABAC policies (sqlite)', () => {
  let db: PatchDb;
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
            'profile/display-name': 'A',
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
        {
          entityId: 'priv-b',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountB,
            'profile/display-name': 'B',
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxA: AppAuthContext = {
      deviceId: '00000000-0000-4000-8000-00000000a001',
      accountId: accountA,
      myId: accountA,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const [forA] = await db.read([{ entityType: 'profile.private' }], ctxA);
    assert.defined(forA, 'forA');
    expect(forA.entities.map((e) => e.entityId)).toEqual(['priv-a']);

    const ctxB: AppAuthContext = {
      deviceId: '00000000-0000-4000-8000-00000000b002',
      accountId: accountB,
      myId: accountB,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const [forB] = await db.read([{ entityType: 'profile.private' }], ctxB);
    assert.defined(forB, 'forB');
    expect(forB.entities.map((e) => e.entityId)).toEqual(['priv-b']);
  });

  test('cross-tenant read of another user private profile is empty', async () => {
    const accountA = '00000000-0000-4000-8000-0000000000cc';
    const accountB = '00000000-0000-4000-8000-0000000000dd';
    await db.write(
      [
        {
          entityId: 'priv-x',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountA,
            'profile/display-name': 'X',
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxB: AppAuthContext = {
      deviceId: '00000000-0000-4000-8000-00000000c003',
      accountId: accountB,
      myId: accountB,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
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
      deviceId: '00000000-0000-4000-8000-00000000e004',
      accountId: '00000000-0000-4000-8000-0000000000ee',
      myId: '00000000-0000-4000-8000-0000000000ee',
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const [r] = await db.read([{ on: 'patches', limit: 5 }], ctx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
    expect(r.patches).toHaveLength(0);
  });

  test('non-system write to stripe.webhook-event is forbidden', async () => {
    const ctx: AppAuthContext = {
      deviceId: '00000000-0000-4000-8000-00000000f005',
      accountId: '00000000-0000-4000-8000-0000000000ff',
      myId: '00000000-0000-4000-8000-0000000000ff',
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: 'evt_bad',
          entityType: 'stripe.webhook-event',
          attributes: {
            'entity/owner': ctx.accountId,
            'patch/created-by-id': ctx.myId,
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
  });

  test('client context can read clientConfig (public)', async () => {
    await db.write(
      [
        {
          entityId: 'client-config__singleton',
          entityType: 'client-config',
          attributes: {
            'client-config/google-web-client-id': 'test-id',
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: PatchDbClientContext = {};
    const [r] = await db.read([{ entityType: 'client-config' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(1);
    expect(r.entities[0]?.entityId).toBe('client-config__singleton');
  });

  test('client context cannot read private entities', async () => {
    await db.write(
      [
        {
          entityId: 'priv-client-test',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': '00000000-0000-4000-8000-0000000000aa',
            'profile/display-name': 'Private',
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: PatchDbClientContext = {};
    const [r] = await db.read([{ entityType: 'profile.private' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
  });

  test('client context can write patches (registry dispatches to policy)', async () => {
    const clientCtx: PatchDbClientContext = {};
    const deviceId = '00000000-0000-4000-8000-00000000a0b1';
    const written = await db.write(
      [
        {
          entityId: deviceId,
          entityType: DEVICE_ENTITY_TYPE,
          attributes: {
            [DeviceAttr.id.key]: deviceId,
            'patch/created-by-id': 'anonymous-client-writer',
          },
        },
      ],
      clientCtx
    );
    expect(written.rejected).toHaveLength(0);
    expect(written.accepted).toHaveLength(1);
    expect(written.accepted[0]?.entityId).toBe(deviceId);
  });

  test('client write to system-only entity (clientConfig) is rejected by policy', async () => {
    const clientCtx: PatchDbClientContext = {};
    const out = await db.write(
      [
        {
          entityId: 'test-entity',
          entityType: 'client-config',
          attributes: {
            'client-config/google-web-client-id': 'hacked',
            'patch/created-by-id': '__hacker__',
          },
        },
      ],
      clientCtx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
    expect(out.rejected[0]?.reason).toContain('system-only');
  });

  test('accountSession: client may push revoke-only for own row', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000d0e1';
    const accountId = '00000000-0000-4000-8000-0000000000e1';
    const sessionEntityId = crypto.randomUUID();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.deviceId.key]: deviceId,
            [AccountSessionAttr.accountId.key]: accountId,
            [AccountSessionAttr.token.key]: 'server-issued-token',
            [AccountSessionAttr.expiresAt.key]: future,
            [AccountSessionAttr.createdAt.key]: new Date().toISOString(),
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctx: AppAuthContext = {
      deviceId,
      accountId,
      myId: accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const epoch = new Date(0).toISOString();
    const out = await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: null,
            [AccountSessionAttr.expiresAt.key]: epoch,
            'patch/created-by-id': accountId,
          },
        },
      ],
      ctx
    );
    expect(out.rejected).toHaveLength(0);
    expect(out.accepted).toHaveLength(1);
  });

  test('accountSession: client cannot create row without server snapshot', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000d0e2';
    const accountId = '00000000-0000-4000-8000-0000000000e2';
    const ctx: AppAuthContext = {
      deviceId,
      accountId,
      myId: accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: crypto.randomUUID(),
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: null,
            [AccountSessionAttr.expiresAt.key]: new Date(0).toISOString(),
            'patch/created-by-id': accountId,
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
  });

  test('accountSession: client cannot set a new token', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000d0e3';
    const accountId = '00000000-0000-4000-8000-0000000000e3';
    const sessionEntityId = crypto.randomUUID();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.deviceId.key]: deviceId,
            [AccountSessionAttr.accountId.key]: accountId,
            [AccountSessionAttr.token.key]: 'a',
            [AccountSessionAttr.expiresAt.key]: future,
            [AccountSessionAttr.createdAt.key]: new Date().toISOString(),
            'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctx: AppAuthContext = {
      deviceId,
      accountId,
      myId: accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: 'hijacked',
            [AccountSessionAttr.expiresAt.key]: new Date(0).toISOString(),
            'patch/created-by-id': accountId,
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
  });

  test('authenticated write still enforces patch/created-by-id match', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000c0d2';
    const accountId = '00000000-0000-4000-8000-0000000000c2';
    const ctx: AppAuthContext = {
      deviceId,
      accountId,
      myId: accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: accountId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.id.key]: accountId,
            'patch/created-by-id': '00000000-0000-4000-8000-00000000dead',
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
  });
});
