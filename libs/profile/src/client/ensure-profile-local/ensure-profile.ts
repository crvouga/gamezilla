import type { MutationClient } from '@pkgs/mutations/client/create-mutation-client';

import {
  applyEnsuredUsernameMutation,
  ensureProfileMutation,
} from '../../shared/mutations/profile-mutations';

/**
 * Ensures a local `profiles` row exists for `auth.userId` (install id
 * when anonymous, account id when signed in). Username is assigned online via
 * `POST /profile/ensure` — this only seeds id / avatar for the sync path.
 */
export async function ensureProfile(
  mutationClient: MutationClient
): Promise<void> {
  const result = await mutationClient.mutate(ensureProfileMutation, {});
  if (!result.ok) throw new Error(result.failures[0]?.message);
}

/**
 * Writes a server-assigned username into the local row when still empty so the
 * profile UI does not wait on PowerSync download after `POST /profile/ensure`.
 */
export async function applyEnsuredUsername(
  mutationClient: MutationClient,
  username: string
): Promise<void> {
  if (username.length === 0) return;
  const result = await mutationClient.mutate(applyEnsuredUsernameMutation, {
    username,
  });
  if (!result.ok) throw new Error(result.failures[0]?.message);
}
