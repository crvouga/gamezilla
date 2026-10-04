import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { friendsActor } from './friends-actor';
import {
  FRIENDS_NOT_FOUND,
  FRIENDS_SELF,
} from './friends-mutation-codes';
import { FriendshipRepository } from './friendship-repository';

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
