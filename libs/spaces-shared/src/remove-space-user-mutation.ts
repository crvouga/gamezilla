import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { spaceUserEntityId } from './participation-ids';
import { requireSpacePermission, spaceIdArgs } from './space-mutation-helpers';
export const removeSpaceUserMutation = defineMutation({
  name: 'removeSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  async run({ tx, env }, { spaceId, userId }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesManageMembers,
      message: 'Only the host can manage space users.',
    });
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${env.now().toISOString()}
      WHERE id = ${spaceUserEntityId(spaceId, userId)}
        AND deleted_at IS NULL
    `);
  },
});
