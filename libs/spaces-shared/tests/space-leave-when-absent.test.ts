import { describe, expect, test } from 'bun:test';

import { openConformanceDb } from '@libs/permissions-shared/world';
import { leaveSpaceMutation } from '@libs/spaces-shared/leave-space-mutation';
import { spaceUserEntityId } from '@libs/spaces-shared/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared/tables';
import { outboxEvents } from '@pkgs/outbox-shared/tables';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

const SPACE_ID = 'space-1';
const HOST = 'host-device';
const NOW = '2026-09-19T08:00:00.000Z';

function guestEnv(deviceId: string): MutationEnv {
  return {
    actorId: deviceId,
    deviceId,
    accountId: null,
    isAnon: true,
    now: () => new Date(NOW),
    serverNow: () => new Date(NOW),
    createId: () => 'minted-id',
  };
}

async function seedSpace(db: SqlClient, joined: string | null): Promise<void> {
  await db.run(sql`
    INSERT INTO spaces (
      id, title, host_id, host_member_id, host_account_id, visibility,
      ended_at, created_at, updated_at, deleted_at
    ) VALUES (
      ${SPACE_ID}, ${null}, ${HOST}, ${HOST}, ${null}, ${'public'},
      ${null}, ${NOW}, ${NOW}, ${null}
    )
  `);
  for (const userId of joined === null ? [HOST] : [HOST, joined]) {
    await db.run(sql`
      INSERT INTO spaces_users (
        id, space_id, user_id, created_by_account_id,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${spaceUserEntityId(SPACE_ID, userId)}, ${SPACE_ID}, ${userId},
        ${null}, ${NOW}, ${NOW}, ${null}
      )
    `);
  }
}

/** The leave as the server replays it; the refusal it met, or null. */
async function leave(db: SqlClient, env: MutationEnv): Promise<unknown> {
  try {
    await db.transaction(async (txc) => {
      const { tx } = wrapMutationDb(txc, env);
      await leaveSpaceMutation.run({ tx, env }, { spaceId: SPACE_ID });
    });
    return null;
  } catch (error) {
    return error;
  }
}

describe('leaving a space', () => {
  // regression: space-leave-when-absent
  test('someone not in the space is refused, not told they left', async () => {
    const db = await openConformanceDb([...SPACES_TABLES, outboxEvents]);
    try {
      await seedSpace(db, null);
      const refusal = await leave(db, guestEnv('outsider-device'));
      expect(refusal).toBeInstanceOf(MutationError);
      expect((refusal as MutationError).code).toBe('SPACE_PERMISSION_DENIED');
    } finally {
      await db.disconnect();
    }
  });

  test('someone who joined the space leaves it', async () => {
    const db = await openConformanceDb([...SPACES_TABLES, outboxEvents]);
    try {
      await seedSpace(db, 'member-device');
      expect(await leave(db, guestEnv('member-device'))).toBeNull();
    } finally {
      await db.disconnect();
    }
  });
});
