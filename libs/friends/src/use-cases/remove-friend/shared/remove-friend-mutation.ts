import {
  defineMutation,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import {
  FRIENDS_NOT_FOUND,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_SELF,
} from '../../../shared/friendship/friends-mutation-codes';
import { FriendshipRepository } from '../../../shared/friendship/friends-sql/friendship-repository';

function actorId(env: MutationEnv): string {
  if (env.accountId === null || env.isAnon) {
    throw new MutationError(
      FRIENDS_NOT_SIGNED_IN,
      'Sign in to manage friends.'
    );
  }
  return env.actorId;
}

export const removeFriendMutation = defineMutation({
  name: 'removeFriend',
  args: z.object({ userId: z.string().min(1) }),
  async run({ tx, env }, { userId }) {
    const actor = actorId(env);
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
