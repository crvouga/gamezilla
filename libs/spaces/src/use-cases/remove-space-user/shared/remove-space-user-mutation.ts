import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  requireHost,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const removeSpaceUserMutation = defineMutation({
  name: 'removeSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  async run({ tx, env }, { spaceId, userId }) {
    await requireHost(
      tx,
      env,
      spaceId,
      'Only the host can manage space users.'
    );
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${env.now().toISOString()}
      WHERE id = ${spaceUserEntityId(spaceId, userId)}
        AND deleted_at IS NULL
    `);
  },
});
