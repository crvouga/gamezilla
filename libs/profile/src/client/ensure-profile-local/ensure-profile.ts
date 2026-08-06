import type { MutationClient } from '@pkgs/sync-engine/mutations/client/create-mutation-client';

import { ensureProfileMutation } from '../../shared/mutations/profile-mutations';

/**
 * Ensures a local `profiles` row exists for `auth.userId` (install id when
 * anonymous, account id when signed in) and assigns an auto username. Upload
 * via `/api/mutations` enforces global uniqueness on Postgres.
 */
export async function ensureProfile(
  mutationClient: MutationClient
): Promise<void> {
  const result = await mutationClient.mutate(ensureProfileMutation, {});
  if (!result.ok) throw new Error(result.failures[0]?.message);
}
