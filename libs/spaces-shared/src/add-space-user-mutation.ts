import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { spaceUserEntityId } from './participation-ids';
import { requireSpacePermission, spaceIdArgs } from './space-mutation-helpers';
export const addSpaceUserMutation = defineMutation({
  name: 'addSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  async run({ tx, env }, { spaceId, userId }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesManageMembers,
      message: 'Only the host can manage space users.',
    });
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
        id, space_id, user_id, created_at, created_by_account_id, joined, participation_revision, deleted_at
      )
      VALUES (${id}, ${spaceId}, ${userId}, ${now}, ${env.accountId}, ${false}, ${0}, ${null})
      ON CONFLICT (id) DO UPDATE SET
        joined = CASE WHEN spaces_users.deleted_at IS NULL THEN spaces_users.joined ELSE ${false} END,
        deleted_at = NULL,
        created_at = excluded.created_at,
        created_by_account_id = excluded.created_by_account_id
    `);
  },
});
