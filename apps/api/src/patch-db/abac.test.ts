import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
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
            'profile/displayName': 'A',
            'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
        {
          entityId: 'priv-b',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': accountB,
            'profile/displayName': 'B',
            'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxA: AppAuthContext = {
      clientId: crypto.randomUUID(),
      deviceId: '00000000-0000-4000-8000-00000000a001',
      accountId: accountA,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const [forA] = await db.read([{ entityType: 'profile.private' }], ctxA);
    assert.defined(forA, 'forA');
    expect(forA.entities.map((e) => e.entityId)).toEqual(['priv-a']);

    const ctxB: AppAuthContext = {
      clientId: crypto.randomUUID(),
      deviceId: '00000000-0000-4000-8000-00000000b002',
      accountId: accountB,
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
            'profile/displayName': 'X',
            'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const ctxB: AppAuthContext = {
      clientId: crypto.randomUUID(),
      deviceId: '00000000-0000-4000-8000-00000000c003',
      accountId: accountB,
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
      clientId: crypto.randomUUID(),
      deviceId: '00000000-0000-4000-8000-00000000e004',
      accountId: '00000000-0000-4000-8000-0000000000ee',
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const [r] = await db.read([{ on: 'patches', limit: 5 }], ctx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
    expect(r.patches).toHaveLength(0);
  });

  test('non-system write to stripe.webhook_event is forbidden', async () => {
    const ctx: AppAuthContext = {
      clientId: crypto.randomUUID(),
      deviceId: '00000000-0000-4000-8000-00000000f005',
      accountId: '00000000-0000-4000-8000-0000000000ff',
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: 'evt_bad',
          entityType: 'stripe.webhook_event',
          attributes: {
            'entity/owner': ctx.accountId,
            'patch/createdBy': ctx.deviceId,
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
          entityId: 'clientConfig__singleton',
          entityType: 'clientConfig',
          attributes: {
            'clientConfig/googleWebClientId': 'test-id',
            'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: PatchDbClientContext = {
      clientId: crypto.randomUUID(),
    };
    const [r] = await db.read([{ entityType: 'clientConfig' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(1);
    expect(r.entities[0]?.entityId).toBe('clientConfig__singleton');
  });

  test('client context cannot read private entities', async () => {
    await db.write(
      [
        {
          entityId: 'priv-client-test',
          entityType: 'profile.private',
          attributes: {
            'entity/owner': '00000000-0000-4000-8000-0000000000aa',
            'profile/displayName': 'Private',
            'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    const clientCtx: PatchDbClientContext = {
      clientId: crypto.randomUUID(),
    };
    const [r] = await db.read([{ entityType: 'profile.private' }], clientCtx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
  });

  test('client context can write patches (registry dispatches to policy)', async () => {
    const clientCtx: PatchDbClientContext = {
      clientId: crypto.randomUUID(),
    };
    const deviceId = '00000000-0000-4000-8000-00000000a0b1';
    const written = await db.write(
      [
        {
          entityId: deviceId,
          entityType: DEVICE_ENTITY_TYPE,
          attributes: {
            [DeviceAttr.id]: deviceId,
            'patch/createdBy': 'anonymous-client-writer',
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
    const clientCtx: PatchDbClientContext = {
      clientId: crypto.randomUUID(),
    };
    const out = await db.write(
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
      clientCtx
    );
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0]?.code).toBe('forbidden');
    expect(out.rejected[0]?.reason).toContain('system-only');
  });

  test('authenticated write still enforces patch/createdBy match', async () => {
    const deviceId = '00000000-0000-4000-8000-00000000c0d2';
    const accountId = '00000000-0000-4000-8000-0000000000c2';
    const ctx: AppAuthContext = {
      clientId: crypto.randomUUID(),
      deviceId,
      accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    };
    const out = await db.write(
      [
        {
          entityId: deviceId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.id]: deviceId,
            'patch/createdBy': '00000000-0000-4000-8000-00000000dead',
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
