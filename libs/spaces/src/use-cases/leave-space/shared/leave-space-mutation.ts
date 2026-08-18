import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import {
  closeSession,
  endSpace,
  getSpaceHost,
  isHost,
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
    await closeSession(tx, env, spaceId);
  },
});
