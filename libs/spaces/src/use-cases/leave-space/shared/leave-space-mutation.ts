import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { spaceUserEntityId } from '../../../shared/space/participation/participation-ids';
import {
  closeSession,
  endSpace,
  getSpaceHost,
  isHost,
  memberId,
  spaceIdArgs,
} from '../../../shared/space/space-mutation-helpers';
export const leaveSpaceMutation = defineMutation({
  name: 'leaveSpace',
  args: spaceIdArgs.extend({ endIfLastSeat: z.boolean().optional() }),
  async run({ tx, env }, { spaceId, endIfLastSeat }) {
    const row = await getSpaceHost(tx, spaceId);
    if (isHost(env, row) || endIfLastSeat === true) {
      if (!isHost(env, row) && endIfLastSeat === true) {
        throw new MutationError(
          'SPACE_WRITE_DENIED',
          'Not allowed to end this space.'
        );
      }
      await endSpace(tx, env, spaceId);
      return;
    }
    const now = env.now().toISOString();
    const actorMemberId = memberId(env);
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${now}
      WHERE id = ${spaceUserEntityId(spaceId, actorMemberId)}
        AND deleted_at IS NULL
    `);
    await closeSession(tx, env, spaceId);
  },
});
