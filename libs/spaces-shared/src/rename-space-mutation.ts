import { moderation } from '@libs/moderation-shared/policy';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

import {
  memberId,
  requireSpacePermission,
  spaceIdArgs,
} from './space-mutation-helpers';
export const renameSpaceMutation = defineMutation({
  name: 'renameSpace',
  args: spaceIdArgs.extend({ title: z.string() }),
  async run({ tx, env }, { spaceId, title }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesRename,
      message: 'Only the host can rename this space.',
    });
    const nextTitle = title.trim();
    if (!moderation.checkWrite('spaceTitle', nextTitle).allowed) {
      throw new MutationError(
        'SPACE_TITLE_NOT_ALLOWED',
        'That space name is not allowed.'
      );
    }
    await tx.run(sql`
      UPDATE spaces
      SET title = ${nextTitle || null},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});
