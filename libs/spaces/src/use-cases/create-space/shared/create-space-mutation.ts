import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  memberId,
  openSession,
  visibilityArgs,
} from '../../../shared/space/space-mutation-helpers';
export const createSpaceMutation = defineMutation({
  name: 'createSpace',
  args: z.object({ spaceId: z.string().min(1), visibility: visibilityArgs }),
  async run({ tx, env }, { spaceId, visibility }) {
    const actorAccountId = env.accountId;
    const actorMemberId = memberId(env);
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO spaces (id, host_id, host_member_id, host_account_id, visibility, created_at, ended_at)
      VALUES (${spaceId}, ${env.deviceId}, ${actorMemberId}, ${actorAccountId}, ${visibility}, ${now}, ${null})
      ON CONFLICT (id) DO UPDATE SET
        host_id = excluded.host_id,
        host_member_id = excluded.host_member_id,
        host_account_id = excluded.host_account_id,
        visibility = excluded.visibility
    `);
    await tx.run(sql`
      INSERT INTO spaces_users (
        id, space_id, user_id, created_at, created_by_account_id, deleted_at
      )
      VALUES (
        ${spaceUserEntityId(spaceId, actorMemberId)}, ${spaceId},
        ${actorMemberId}, ${now}, ${actorAccountId}, ${null}
      )
      ON CONFLICT (id) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at,
        created_by_account_id = excluded.created_by_account_id
    `);
    await openSession(tx, env, spaceId, true);
  },
});
