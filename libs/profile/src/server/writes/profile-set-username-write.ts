import { defineWrite } from '@pkgs/write/shared/define-write';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { writeStoreAsSqlClient } from '@pkgs/write/server/write-store-as-sql-client';

import {
  isProfileError,
  profileErrorFromValidation,
} from '../../shared/profile-errors';
import type { ProfileCard } from '../../shared/profile-card';
import { normalizeUsername, validateUsername } from '../../shared/username';
import { setProfileUsername } from '../set-username-service';

export type ProfileSetUsernameInput = {
  readonly username: string;
};

function parseProfileSetUsernameInput(
  raw: unknown
): ReturnType<typeof ok<ProfileSetUsernameInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'username input must be an object');
  }
  const username = (raw as Record<string, unknown>)['username'];
  if (typeof username !== 'string') {
    return fail('INVALID_INPUT', 'username is required');
  }
  return ok({ username });
}

export const profileSetUsernameWrite = defineWrite<
  ProfileSetUsernameInput,
  ProfileCard
>({
  name: 'profile.setUsername',
  parseInput: parseProfileSetUsernameInput,
  authorize: async (ctx, input) => {
    if (ctx.myId.length === 0) {
      return fail('PROFILE_NOT_AUTHENTICATED', 'not authenticated');
    }
    const username = normalizeUsername(input.username);
    const validationError = validateUsername(username);
    if (validationError !== null) {
      const err = profileErrorFromValidation(validationError);
      return fail(err.code, err.message);
    }
    return ok(undefined);
  },
  execute: async (ctx, input, store) => {
    try {
      const card = await setProfileUsername(
        writeStoreAsSqlClient(store),
        ctx.myId,
        input.username
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
