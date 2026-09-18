import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';

import {
  memberId,
  requireHost,
  spaceIdArgs,
  visibilityArgs,
} from '../../../shared/space/space-mutation-helpers';
export const setVisibilityMutation = defineMutation({
  name: 'setVisibility',
  args: spaceIdArgs.extend({ visibility: visibilityArgs }),
  async run({ tx, env }, { spaceId, visibility }) {
    await requireHost(tx, env, spaceId, 'Only the host can change visibility.');
    await tx.run(sql`
      UPDATE spaces
      SET visibility = ${visibility},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});
