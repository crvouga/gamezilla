import { requireLimitInMutation } from '@libs/permissions/public/mutation-permission';
import { LIMIT } from '@libs/permissions/public/permission-catalog';
import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { liveHostedSpacesCountSql } from '../../../shared/space/hosted-spaces-sql';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  memberId,
  openSession,
} from '../../../shared/space/space-mutation-helpers';

/**
 * Open a space the actor hosts. Guests and free accounts host one live space
 * at a time (`spaces:hosted`); reaching it is a permanent `limit_reached`
 * rejection whose decision invites to Plus. Every space is public: anyone
 * with its link may join (visibility is not a v1 choice).
 */
export const createSpaceMutation = defineMutation({
  name: 'createSpace',
  args: z.object({ spaceId: z.string().min(1) }),
  async run({ tx, env }, { spaceId }) {
    const actorAccountId = env.accountId;
    const actorMemberId = memberId(env);
    const now = env.now().toISOString();
    const existing = await tx.query<{ host_account_id: string }>(sql`
      SELECT host_account_id
      FROM spaces
      WHERE id = ${spaceId} AND deleted_at IS NULL
      LIMIT 1
    `);
    const owner = existing[0]?.host_account_id;
    if (owner !== undefined && owner !== actorAccountId) {
      throw new MutationError(
        'SPACE_TAKEN',
        'This space already belongs to another account.'
      );
    }
    const hosted = await tx.query(
      liveHostedSpacesCountSql({
        memberId: actorMemberId,
        exceptSpaceId: spaceId,
      })
    );
    await requireLimitInMutation(
      { tx, env },
      LIMIT.hostedSpaces,
      Number(hosted[0]?.hosted ?? 0)
    );
    await tx.run(sql`
      INSERT INTO spaces (id, host_id, host_member_id, host_account_id, visibility, created_at, ended_at)
      VALUES (${spaceId}, ${env.deviceId}, ${actorMemberId}, ${actorAccountId}, ${'public'}, ${now}, ${null})
      ON CONFLICT (id) DO NOTHING
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
