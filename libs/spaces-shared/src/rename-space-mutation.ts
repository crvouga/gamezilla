import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
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
    await tx.run(sql`
      UPDATE spaces
      SET title = ${title.trim() || null},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});
