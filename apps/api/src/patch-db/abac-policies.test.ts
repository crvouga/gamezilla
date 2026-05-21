import { buildAppAuthContext } from '@libs/auth/shared/auth-context';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@libs/profile/shared/profile-entities';
import { assert } from '@pkgs/assert';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplSqlite } from '@pkgs/patch-db/impl-sqlite/impl-sqlite';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@pkgs/patch-db/interface';
import {
  PatchMetaAttr,
  PATCH_REJECT_CODE,
} from '@pkgs/patch-db/metadata/patch-metadata';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@pkgs/patch-db/policy/system-device';
import { StripeAttr } from '@libs/stripe/stripe-attrs';
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

describe('gamezilla default policies (system + auth writes)', () => {
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

  test('system context write succeeds for system-only entity types', async () => {
    const owner = '00000000-0000-4000-8000-000000000099';
    await db.write(
      [
        {
          entityId: 'evt_sys_test',
          entityType: 'stripe.webhook-event',
          attributes: {
            ...AbacEntityAttr.owner(owner),
            ...StripeAttr.webhookEventType('customer.created'),
            ...StripeAttr.stripeObjectId('evt_sys_test'),
            ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    const [r] = await db.read(
      [
        {
          entityType: 'stripe.webhook-event',
          entityId: 'evt_sys_test',
          limit: 1,
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    assert.defined(r, 'read result');
    expect(r.entities.length).toBe(1);
  });

  test('authenticated write rejects patch/created-by-id mismatch', async () => {
    const deviceId = '00000000-0000-4000-8000-000000000011';
    const userId = '00000000-0000-4000-8000-000000000022';
    const ctx = buildAppAuthContext({
      deviceId,
      accountId: userId,
      myId: userId,
    });
    const out = await db.write(
      [
        {
          entityId: userId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.id.key]: userId,
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
    expect(out.rejected[0]?.code).toBe(PATCH_REJECT_CODE.forbidden.key);
  });
});
