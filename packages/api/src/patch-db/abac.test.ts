import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/auth/shared';
import { buildAppAuthContext } from '@gamezilla/auth/shared/auth-context';
import { ClientConfigAttr } from '@gamezilla/client-config/shared/client-config-entities';
import { assert } from '@gamezilla/lib/assert';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import { PatchMetaAttr } from '@gamezilla/patch-db/metadata/patch-metadata';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/profile/shared/profile-entities';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { AbacEntityAttr } from './abac-patch-attrs';
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
            ...AbacEntityAttr.owner(accountA),
            ...ProfileAttr.displayName('A'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
        {
          entityId: 'priv-b',
          entityType: 'profile.private',
          attributes: {
            ...AbacEntityAttr.owner(accountB),
            ...ProfileAttr.displayName('B'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxA = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000a001',
      accountId: accountA,
      myId: accountA,
    });
    const [forA] = await db.read([{ entityType: 'profile.private' }], ctxA);
    assert.defined(forA, 'forA');
    expect(forA.entities.map((e) => e.entityId)).toEqual(['priv-a']);

    const ctxB = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000b002',
      accountId: accountB,
      myId: accountB,
    });
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
            ...AbacEntityAttr.owner(accountA),
            ...ProfileAttr.displayName('X'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxB = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000c003',
      accountId: accountB,
      myId: accountB,
    });
    const [forB] = await db.read(
      [{ entityType: 'profile.private', entityId: 'priv-x' }],
      ctxB
    );
    assert.defined(forB, 'forB');
    expect(forB.entities).toHaveLength(0);
  });

  test('query without entityType is denied for auth context', async () => {
    const ctx = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000e004',
      accountId: '00000000-0000-4000-8000-0000000000ee',
      myId: '00000000-0000-4000-8000-0000000000ee',
    });
    const [r] = await db.read([{ on: 'patches', limit: 5 }], ctx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
    expect(r.patches).toHaveLength(0);
  });

  test('non-system write to stripe.webhook-event is forbidden', async () => {
    const accountId = '00000000-0000-4000-8000-0000000000ff';
    const ctx = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000f005',
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: 'evt_bad',
          entityType: 'stripe.webhook-event',
          attributes: {
            ...AbacEntityAttr.owner(accountId),
            ...PatchMetaAttr.createdById(accountId),
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
            ...ClientConfigAttr.googleWebClientId('test-id'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: Readonly<Record<string, unknown>> = {};
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
            ...AbacEntityAttr.owner('00000000-0000-4000-8000-0000000000aa'),
            ...ProfileAttr.displayName('Private'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: Readonly<Record<string, unknown>> = {};
    const [r] = await db.read([{ entityType: 'profile.private' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
  });

  test('client context can write patches (registry dispatches to policy)', async () => {
    const clientCtx: Readonly<Record<string, unknown>> = {};
    const deviceId = '00000000-0000-4000-8000-00000000a0b1';
    const written = await db.write(
      [
        {
          entityId: deviceId,
          entityType: DEVICE_ENTITY_TYPE,
          attributes: {
            [DeviceAttr.id.key]: deviceId,
            ...PatchMetaAttr.createdById('anonymous-client-writer'),
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
    const clientCtx: Readonly<Record<string, unknown>> = {};
    const out = await db.write(
      [
        {
          entityId: 'test-entity',
          entityType: 'client-config',
          attributes: {
            ...ClientConfigAttr.googleWebClientId('hacked'),
            ...PatchMetaAttr.createdById('__hacker__'),
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

  test('accountSession: client cannot push revoke patch (server-managed)', async () => {
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
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctx = buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
    });
    const epoch = new Date(0).toISOString();
    const out = await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: null,
            [AccountSessionAttr.expiresAt.key]: epoch,
            ...PatchMetaAttr.createdById(accountId),
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
  });

  test('accountSession: client cannot create row without server snapshot', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000d0e2';
    const accountId = '00000000-0000-4000-8000-0000000000e2';
    const ctx = buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: crypto.randomUUID(),
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: null,
            [AccountSessionAttr.expiresAt.key]: new Date(0).toISOString(),
            ...PatchMetaAttr.createdById(accountId),
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
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctx = buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: sessionEntityId,
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            [AccountSessionAttr.token.key]: 'hijacked',
            [AccountSessionAttr.expiresAt.key]: new Date(0).toISOString(),
            ...PatchMetaAttr.createdById(accountId),
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
  });

  test('todo-list-item: authenticated write succeeds when createdBy matches', async () => {
    const accountId = '00000000-0000-4000-8000-0000000000a1';
    const ctx = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000a101',
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: 'todo-1',
          entityType: 'todo-list-item',
          attributes: {
            'todo-list-item/title': 'hello',
            ...PatchMetaAttr.createdById(accountId),
          },
        },
      ],
      ctx
    );
    expect(out.rejected).toHaveLength(0);
    expect(out.accepted).toHaveLength(1);

    const [r] = await db.read([{ entityType: 'todo-list-item' }], ctx);
    assert.defined(r, 'r');
    expect(r.entities.map((e) => e.entityId)).toEqual(['todo-1']);
  });

  test('todo-list: authenticated write succeeds and is readable', async () => {
    const accountId = '00000000-0000-4000-8000-0000000000b1';
    const ctx = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000b101',
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: 'list-1',
          entityType: 'todo-list',
          attributes: {
            'todo-list/name': 'mine',
            ...PatchMetaAttr.createdById(accountId),
          },
        },
      ],
      ctx
    );
    expect(out.rejected).toHaveLength(0);

    const [r] = await db.read([{ entityType: 'todo-list' }], ctx);
    assert.defined(r, 'r');
    expect(r.entities.map((e) => e.entityId)).toEqual(['list-1']);
  });

  test('todo-list-item: unauthenticated client read returns empty', async () => {
    await db.write(
      [
        {
          entityId: 'todo-sys',
          entityType: 'todo-list-item',
          attributes: {
            'todo-list-item/title': 'sys',
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: Readonly<Record<string, unknown>> = {};
    const [r] = await db.read([{ entityType: 'todo-list-item' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
  });

  test('todo-list-item: authenticated write rejects mismatched created-by-id', async () => {
    const accountId = '00000000-0000-4000-8000-0000000000d1';
    const ctx = buildAppAuthContext({
      deviceId: '00000000-0000-4000-8000-00000000d1de',
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: 'todo-mismatch',
          entityType: 'todo-list-item',
          attributes: {
            'todo-list-item/title': 'x',
            ...PatchMetaAttr.createdById(
              '00000000-0000-4000-8000-00000000dead'
            ),
          },
        },
      ],
      ctx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
  });

  test('authenticated write still enforces patch/created-by-id match', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000c0d2';
    const accountId = '00000000-0000-4000-8000-0000000000c2';
    const ctx = buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
    });
    const out = await db.write(
      [
        {
          entityId: accountId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.id.key]: accountId,
            ...PatchMetaAttr.createdById(
              '00000000-0000-4000-8000-00000000dead'
            ),
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
