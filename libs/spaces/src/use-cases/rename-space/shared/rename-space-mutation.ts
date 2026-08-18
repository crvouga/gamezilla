import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import {
  memberId,
  requireHost,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const renameSpaceMutation = defineMutation({
  name: 'renameSpace',
  args: spaceIdArgs.extend({ title: z.string() }),
  async run({ tx, env }, { spaceId, title }) {
    await requireHost(tx, env, spaceId, 'Only the host can rename this space.');
    await tx.run(sql`
      UPDATE spaces
      SET title = ${title.trim() || null},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});
