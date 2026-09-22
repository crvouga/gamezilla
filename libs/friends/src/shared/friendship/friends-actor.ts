import { requireInMutation } from '@libs/permissions/public/mutation-permission';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import type { MutationDb, MutationEnv } from '@pkgs/sync-engine/shared';

/**
 * The acting user, once the permission system lets them use friends. A denial
 * is a permanent rejection carrying the decision; friends never learns why.
 */
export async function friendsActor(
  tx: MutationDb,
  env: MutationEnv
): Promise<string> {
  await requireInMutation({ tx, env }, PERMISSION.friendsUse);
  return env.actorId;
}
