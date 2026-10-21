import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { spaceUserEntityId } from './participation-ids';
import {
  getSpaceHost,
  hostMemberId,
  requireSpacePermission,
  spaceIdArgs,
} from './space-mutation-helpers';
import { changeSpaceRoomMembership } from './space-withdrawal';
export const removeSpaceUserMutation = defineMutation({
  name: 'removeSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  async run({ tx, env }, { spaceId, userId }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesManageMembers,
      message: 'Only the host can manage space users.',
    });
    if (userId === hostMemberId(await getSpaceHost(tx, spaceId))) {
      throw new MutationError(
        'SPACE_INVALID_INPUT',
        'Use Leave to end your space.'
      );
    }
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${env.now().toISOString()}, joined = ${false},
        participation_revision = participation_revision + 1
      WHERE id = ${spaceUserEntityId(spaceId, userId)}
        AND deleted_at IS NULL
    `);
    await changeSpaceRoomMembership({ tx, env }, spaceId, 'left', userId);
  },
});
