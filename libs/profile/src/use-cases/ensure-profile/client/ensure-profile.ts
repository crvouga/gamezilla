import type { MutationClient } from '@pkgs/sync-engine/client';

import { ensureProfileMutation } from '../../shared/mutations/profile-mutations';

/**
 * Ensures a local `profiles` row exists for `auth.userId` (install id when
 * anonymous, account id when signed in) and assigns an auto username. Upload
 * via `/api/mutations` enforces global uniqueness on Postgres.
 */
export class ProfileEnsurer {
  constructor(private readonly mutationClient: MutationClient) {}

  async ensure(): Promise<void> {
    const result = await this.mutationClient.mutate(ensureProfileMutation, {});
    if (!result.ok) throw new Error(result.failures[0]?.message);
  }
}
