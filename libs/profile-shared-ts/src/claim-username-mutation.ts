import { contentRulesIn } from '@libs/moderation-shared-ts/mutation-content';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';

import { serializeDefaultAvatarConfig } from './avatar-config';
import { seedProfile } from './seed-profile';
import {
  canChangeUsername,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from './username';
import {
  USERNAME_NORM_UNIQUE_INDEX,
  USERNAME_TAKEN_CONSTRAINT_ERROR,
} from './username-column';

type UsernameRow = {
  readonly username: string | null;
  readonly username_changed_at: string | null;
};

function usernameFailure(error: ReturnType<typeof validateUsername>): never {
  switch (error) {
    case 'empty':
      throw new MutationError('USERNAME_EMPTY', 'Username is required.');
    case 'too_short':
      throw new MutationError(
        'USERNAME_TOO_SHORT',
        `Username needs at least ${USERNAME_MIN_LENGTH} characters.`
      );
    case 'too_long':
      throw new MutationError(
        'USERNAME_TOO_LONG',
        `Username can have at most ${USERNAME_MAX_LENGTH} characters.`
      );
    case 'invalid_format':
      throw new MutationError(
        'USERNAME_INVALID_FORMAT',
        'Username can only use letters, numbers, and underscores.'
      );
    case 'blocked':
      throw new MutationError(
        'USERNAME_BLOCKED',
        'That username is not allowed.'
      );
    default:
      throw new MutationError('INVALID_USERNAME', 'Username is invalid.');
  }
}

async function getUsernameRow(
  tx: MutationDb,
  profileId: string
): Promise<UsernameRow> {
  const rows = await tx.query(sql<UsernameRow>`
    SELECT username, username_changed_at
    FROM profile
    WHERE id = ${profileId}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) {
    throw new MutationError('PROFILE_NOT_FOUND', 'Profile not found.');
  }
  return row;
}

export const claimUsernameMutation = defineMutation({
  name: 'claimUsername',
  args: z.object({ username: z.string() }),
  pendingUx: 'local',
  contentRulesTime: 'replayed',
  constraintErrors: {
    [USERNAME_NORM_UNIQUE_INDEX]: USERNAME_TAKEN_CONSTRAINT_ERROR,
  },
  async run({ tx, env }, { username: rawUsername }) {
    const username = normalizeUsername(rawUsername).toLowerCase();
    const validationError = validateUsername(username, contentRulesIn(env));
    if (validationError !== null) usernameFailure(validationError);
    const now = env.now().toISOString();
    await seedProfile(tx, env, serializeDefaultAvatarConfig(env.actorId));
    const row = await getUsernameRow(tx, env.actorId);
    if (row.username === username) return;
    if (!canChangeUsername(row.username_changed_at, env.now().getTime())) {
      throw new MutationError(
        'USERNAME_COOLDOWN',
        'Username was changed recently.'
      );
    }
    const taken = await tx.query(sql<{ one: number }>`
      SELECT 1 AS one
      FROM profile
      WHERE username_norm = ${username}
        AND id <> ${env.actorId}
        AND username <> ''
      LIMIT 1
    `);
    if (taken.length > 0) {
      throw new MutationError('USERNAME_TAKEN', 'Username is taken.');
    }
    await tx.run(sql`
      UPDATE profile
      SET username = ${username},
          username_norm = ${username},
          username_changed_at = ${now}
      WHERE id = ${env.actorId}
    `);
  },
});
