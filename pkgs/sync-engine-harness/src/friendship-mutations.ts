import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

function friendshipId(userLow: string, userHigh: string): string {
  return `friendship:${userLow}:${userHigh}`;
}

function canonicalPair(
  a: string,
  b: string
): { readonly userLow: string; readonly userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}

/** Upsert a friendship between the actor and peer (canonical user_low/high). */
export const befriend = defineMutation({
  name: 'befriend',
  args: z.object({ peerId: z.string().min(1) }),
  async run({ tx, env }, { peerId }) {
    if (peerId === env.actorId) {
      throw new MutationError('INVALID_ARGS', 'Cannot befriend self');
    }
    const { userLow, userHigh } = canonicalPair(env.actorId, peerId);
    const id = friendshipId(userLow, userHigh);
    await tx.run(sql`
      INSERT INTO friends_friendships (id, user_low, user_high)
      VALUES (${id}, ${userLow}, ${userHigh})
      ON CONFLICT (id) DO UPDATE SET
        user_low = excluded.user_low,
        user_high = excluded.user_high,
        deleted_at = NULL
    `);
  },
});
