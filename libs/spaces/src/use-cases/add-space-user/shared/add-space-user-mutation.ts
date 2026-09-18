import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  requireHost,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const addSpaceUserMutation = defineMutation({
  name: 'addSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  async run({ tx, env }, { spaceId, userId }) {
    await requireHost(
      tx,
      env,
      spaceId,
      'Only the host can manage space users.'
    );
    if (userId === env.accountId) {
      throw new MutationError(
        'SPACE_INVALID_INPUT',
        'Host is already a space user.'
      );
    }
    const id = spaceUserEntityId(spaceId, userId);
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO spaces_users (
        id, space_id, user_id, created_at, created_by_account_id, deleted_at
      )
      VALUES (${id}, ${spaceId}, ${userId}, ${now}, ${env.accountId}, ${null})
      ON CONFLICT (id) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at,
        created_by_account_id = excluded.created_by_account_id
    `);
  },
});
