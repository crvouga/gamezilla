import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { friendsActor } from '../../../shared/friendship/friends-actor';
import {
  FRIENDS_NOT_FOUND,
  FRIENDS_SELF,
} from '../../../shared/friendship/friends-mutation-codes';
import { FriendshipRepository } from '../../../shared/friendship/friends-sql/friendship-repository';

export const removeFriendMutation = defineMutation({
  name: 'removeFriend',
  args: z.object({ userId: z.string().min(1) }),
  async run({ tx, env }, { userId }) {
    const actor = await friendsActor(tx, env);
    if (actor === userId) {
      throw new MutationError(FRIENDS_SELF, 'Cannot remove yourself.');
    }
    if (!(await new FriendshipRepository(tx).exists(actor, userId))) {
      throw new MutationError(FRIENDS_NOT_FOUND, 'Friendship not found.');
    }
    await new FriendshipRepository(tx).softDelete(
      actor,
      userId,
      env.now().toISOString()
    );
  },
});
