import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { writeStoreAsSqlClient } from '@pkgs/write/server/write-store-as-sql-client';

import { isProfileError } from '../../shared/profile-errors';
import type { ProfileCard } from '../../shared/profile-card';
import { ensureProfileWithUsername } from '../ensure-profile-service';

export type ProfileEnsureInput = Record<string, never>;

function parseProfileEnsureInput(
  _raw: unknown
): ReturnType<typeof ok<ProfileEnsureInput>> {
  return ok({});
}

export const profileEnsureWrite = defineWrite<ProfileEnsureInput, ProfileCard>({
  name: 'profile.ensure',
  parseInput: parseProfileEnsureInput,
  authorize: async (ctx) => {
    if (ctx.myId.length === 0) {
      return fail('PROFILE_NOT_AUTHENTICATED', 'not authenticated');
    }
    return ok(undefined);
  },
  execute: async (ctx, _input, store) => {
    try {
      const card = await ensureProfileWithUsername(
        writeStoreAsSqlClient(store),
        ctx.myId
      );
      return ok(card);
    } catch (error) {
      if (isProfileError(error)) {
        return fail(error.code, error.message);
      }
      throw error;
    }
  },
});
