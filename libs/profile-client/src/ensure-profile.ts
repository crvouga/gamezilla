import {
  peekPendingSignupUsername,
  takePendingSignupUsername,
} from '@libs/auth-shared/pending-signup-username';
import { ensureProfileMutation } from '@libs/profile-shared/ensure-profile-mutation';
import type { MutationClient } from '@pkgs/sync-engine-client/create-mutation-client';

/**
 * Ensures a local `profiles` row exists for `auth.userId` (install id when
 * anonymous, account id when signed in). Create-account can pass a preferred
 * username via pending signup state; otherwise an auto username is assigned.
 * Upload via `/api/mutations` enforces global uniqueness on Postgres.
 */
export class ProfileEnsurer {
  constructor(
    private readonly mutationClient: MutationClient,
    private readonly authClient: object
  ) {}

  async ensure(externalUserId: string | null): Promise<void> {
    const username = peekPendingSignupUsername(this.authClient, externalUserId);
    const result = await this.mutationClient.mutate(
      ensureProfileMutation,
      username === null ? {} : { username }
    );
    if (!result.ok) throw new Error(result.failures[0]?.message);
    if (username !== null) takePendingSignupUsername(this.authClient);
  }
}
