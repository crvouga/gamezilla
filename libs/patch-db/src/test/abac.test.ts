import { assert } from '@gamezilla/lib/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { ForbiddenError } from '../forbidden-error';
import type { PatchesDb } from '../interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '../interface';
import { installDefaultPatchDbPolicies } from '../policy/install-default-patch-db-policies';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '../policy/system-principal';
import { createSqliteFactory } from './test-helpers';

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

    const ctxA = {
      principalId: '00000000-0000-4000-8000-00000000a001',
      accountId: accountA,
      memberOfSpaceIds: [] as const,
      friendAccountIds: [] as const,
      blockedAccountIds: [] as const,
    };
    const [forA] = await db.read(
      [{ entityType: 'profile.private' }],
      ctxA
    );
    assert.defined(forA, 'forA');
    expect(forA.entities.map((e) => e.entityId)).toEqual(['priv-a']);

    const ctxB = {
      principalId: '00000000-0000-4000-8000-00000000b002',
      accountId: accountB,
      memberOfSpaceIds: [] as const,
      friendAccountIds: [] as const,
      blockedAccountIds: [] as const,
    };
    const [forB] = await db.read(
      [{ entityType: 'profile.private' }],
      ctxB
    );
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

    const ctxB = {
      principalId: '00000000-0000-4000-8000-00000000c003',
      accountId: accountB,
      memberOfSpaceIds: [] as const,
      friendAccountIds: [] as const,
      blockedAccountIds: [] as const,
    };
    const [forB] = await db.read(
      [{ entityType: 'profile.private', entityId: 'priv-x' }],
      ctxB
    );
    assert.defined(forB, 'forB');
    expect(forB.entities).toHaveLength(0);
  });

  test('query without entityType is denied for auth context', async () => {
    const ctx = {
      principalId: '00000000-0000-4000-8000-00000000e004',
      accountId: '00000000-0000-4000-8000-0000000000ee',
      memberOfSpaceIds: [] as const,
      friendAccountIds: [] as const,
      blockedAccountIds: [] as const,
    };
    const [r] = await db.read([{ on: 'patches', limit: 5 }], ctx);
    assert.defined(r, 'r');
    expect(r.entities).toHaveLength(0);
    expect(r.patches).toHaveLength(0);
  });

  test('non-system write to stripe.webhook_event is forbidden', async () => {
    const ctx = {
      principalId: '00000000-0000-4000-8000-00000000f005',
      accountId: '00000000-0000-4000-8000-0000000000ff',
      memberOfSpaceIds: [] as const,
      friendAccountIds: [] as const,
      blockedAccountIds: [] as const,
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
});
