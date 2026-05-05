import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { assert } from '@gamezilla/lib/assert';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
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
          entityType: 'stripe.webhook_event',
          attributes: {
            'entity/owner': owner,
            'stripe/webhookEventType': 'customer.created',
            'stripe/stripeObjectId': 'evt_sys_test',
            'patch/createdById': PATCH_DB_SYSTEM_DEVICE_ID,
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    const [r] = await db.read(
      [
        {
          entityType: 'stripe.webhook_event',
          entityId: 'evt_sys_test',
          limit: 1,
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    assert.defined(r, 'read result');
    expect(r.entities.length).toBe(1);
  });

  test('authenticated write rejects patch/createdById mismatch', async () => {
    const deviceId = '00000000-0000-4000-8000-000000000011';
    const userId = '00000000-0000-4000-8000-000000000022';
    const ctx = {
      clientId: crypto.randomUUID(),
      deviceId,
      accountId: userId,
      myId: userId,
      memberOfSpaceIds: [] as readonly string[],
      friendUserIds: [] as readonly string[],
      blockedUserIds: [] as readonly string[],
    };
    const out = await db.write(
      [
        {
          entityId: userId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.id]: userId,
            'patch/createdById': '00000000-0000-4000-8000-00000000dead',
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
