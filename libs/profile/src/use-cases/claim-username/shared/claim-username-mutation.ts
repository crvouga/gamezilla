import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { serializeDefaultAvatarConfig } from '../../../shared/profile/avatar-config';
import {
  canChangeUsername,
  normalizeUsername,
  validateUsername,
} from '../../../shared/profile/username';
import { generateRandomUsername } from '../../../shared/profile/username-generator';

const PROFILE_SEED_USERNAME_ATTEMPTS = 8;

type UsernameRow = {
  readonly username: string | null;
  readonly username_changed_at: string | null;
};

function usernameFailure(error: ReturnType<typeof validateUsername>): never {
  switch (error) {
    case 'empty':
      throw new MutationError('USERNAME_EMPTY', 'Username is required.');
    case 'too_short':
      throw new MutationError('USERNAME_TOO_SHORT', 'Username is too short.');
    case 'too_long':
      throw new MutationError('USERNAME_TOO_LONG', 'Username is too long.');
    case 'invalid_format':
      throw new MutationError(
        'USERNAME_INVALID_FORMAT',
        'Username can only use letters, numbers, and underscores.'
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

async function seedProfile(
  tx: MutationDb,
  profileId: string,
  now: string,
  avatarConfig: string
): Promise<void> {
  let username = '';
  for (
    let attempt = 0;
    attempt < PROFILE_SEED_USERNAME_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = generateRandomUsername(`${profileId}:seed:${attempt}`);
    const taken = await tx.query(sql<{ one: number }>`
      SELECT 1 AS one
      FROM profile
      WHERE lower(username) = ${candidate.toLowerCase()}
        AND username <> ''
      LIMIT 1
    `);
    if (taken.length > 0) continue;
    username = candidate;
    break;
  }
  if (username.length === 0) {
    throw new MutationError(
      'USERNAME_TAKEN',
      'Could not assign a unique username.'
    );
  }
  await tx.run(sql`
    INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
    VALUES (
      ${profileId},
      ${now},
      ${username},
      ${username.toLowerCase()},
      ${avatarConfig}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

export const claimUsernameMutation = defineMutation({
  name: 'claimUsername',
  args: z.object({ username: z.string() }),
  pendingUx: 'pending',
  requiresOnline: true,
  async run({ tx, env }, { username: rawUsername }) {
    const username = normalizeUsername(rawUsername).toLowerCase();
    const validationError = validateUsername(username);
    if (validationError !== null) usernameFailure(validationError);
    const now = env.now().toISOString();
    await seedProfile(
      tx,
      env.actorId,
      now,
      serializeDefaultAvatarConfig(env.actorId)
    );
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
