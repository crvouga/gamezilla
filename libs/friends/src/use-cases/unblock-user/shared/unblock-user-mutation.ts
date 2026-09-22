import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { friendsActor } from '../../../shared/friendship/friends-actor';
import { FRIENDS_SELF } from '../../../shared/friendship/friends-mutation-codes';
import { UserBlockRepository } from '../../../shared/friendship/friends-sql/user-block-repository';

export const unblockUserMutation = defineMutation({
  name: 'unblockUser',
  args: z.object({ userId: z.string().min(1) }),
  async run({ tx, env }, { userId }) {
    const actor = await friendsActor(tx, env);
    if (actor === userId) {
      throw new MutationError(FRIENDS_SELF, 'Cannot unblock yourself.');
    }
    await new UserBlockRepository(tx).softDelete(
      actor,
      userId,
      env.now().toISOString()
    );
  },
});
