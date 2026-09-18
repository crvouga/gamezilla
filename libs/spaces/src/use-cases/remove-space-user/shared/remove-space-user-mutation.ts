import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  requireSpacePermission,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
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
