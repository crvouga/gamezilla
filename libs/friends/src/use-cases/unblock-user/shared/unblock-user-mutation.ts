import {
  defineMutation,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import {
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_SELF,
} from '../../../shared/friendship/friends-mutation-codes';
import { UserBlockRepository } from '../../../shared/friendship/friends-sql/user-block-repository';

function actorId(env: MutationEnv): string {
  if (env.accountId === null || env.isAnon) {
    throw new MutationError(
      FRIENDS_NOT_SIGNED_IN,
      'Sign in to manage friends.'
    );
  }
  return env.actorId;
}

export const unblockUserMutation = defineMutation({
  name: 'unblockUser',
  args: z.object({ userId: z.string().min(1) }),
  async run({ tx, env }, { userId }) {
    const actor = actorId(env);
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
