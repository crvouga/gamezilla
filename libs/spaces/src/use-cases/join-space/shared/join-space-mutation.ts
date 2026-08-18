import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  accountId,
  getSpaceHost,
  isHost,
  memberId,
  openSession,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const joinSpaceMutation = defineMutation({
  name: 'joinSpace',
  args: spaceIdArgs,
  async run({ tx, env }, { spaceId }) {
    const actorAccountId = accountId(env);
    const row = await getSpaceHost(tx, spaceId);
    if (row.ended_at !== null) {
      throw new MutationError('SPACE_ENDED', 'This space has ended.');
    }
    const actorMemberId = memberId(env);
    const id = spaceUserEntityId(spaceId, actorMemberId);
    const present = await tx.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces_users
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `);
    if (
      row.visibility !== 'public' &&
      present.length === 0 &&
      !isHost(env, row)
    ) {
      throw new MutationError(
        'SPACE_VISIBILITY_DENIED',
        'Not allowed to join this space.'
      );
    }
    if (present.length === 0) {
      const now = env.now().toISOString();
      await tx.run(sql`
        INSERT INTO spaces_users (
          id, space_id, user_id, created_at, created_by_account_id, deleted_at
        )
        VALUES (
          ${id}, ${spaceId}, ${actorMemberId}, ${now}, ${actorAccountId}, ${null}
        )
        ON CONFLICT (id) DO UPDATE SET
          deleted_at = NULL,
          created_at = excluded.created_at,
          created_by_account_id = excluded.created_by_account_id
      `);
    }
    if (isHost(env, row)) {
      await tx.run(sql`
        UPDATE spaces
        SET host_member_id = ${actorMemberId}, host_account_id = ${actorAccountId}
        WHERE id = ${spaceId}
      `);
    }
    await openSession(tx, env, spaceId);
  },
});
