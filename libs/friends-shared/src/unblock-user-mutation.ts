import { lockOwners } from '@pkgs/matchmaking-sql-shared/owner-repository';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { friendsActor } from './friends-actor';
import { FRIENDS_SELF } from './friends-mutation-codes';
import { BlockChanged } from './friends-outbox-messages';
import { UserBlockRepository } from './user-block-repository';

export const unblockUserMutation = defineMutation({
  name: 'unblockUser',
  args: z.object({ userId: z.string().min(1) }),
  async run({ tx, env }, { userId }) {
    const actor = await friendsActor(tx, env);
    if (env.serverNow !== undefined)
      await lockOwners(tx, [actor, userId], env.serverNow().toISOString());
    if (actor === userId) {
      throw new MutationError(FRIENDS_SELF, 'Cannot unblock yourself.');
    }
    await new UserBlockRepository(tx).softDelete(
      actor,
      userId,
      env.now().toISOString()
    );
    await new Outbox({ tx, env }).send({
      id: `friends.outbox/block-changed:${env.createId()}`,
      message: BlockChanged({ blockerId: actor, blockedId: userId }),
    });
  },
});
