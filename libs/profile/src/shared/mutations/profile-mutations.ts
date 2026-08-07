import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { userTopic } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/mutations/core/define-mutation';
import {
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/mutations/core/types';
import { z } from 'zod';

import {
  parseAvatarConfig,
  serializeAvatarConfig,
  serializeDefaultAvatarConfig,
} from '../avatar-config';
import {
  canChangeUsername,
  normalizeUsername,
  validateUsername,
} from '../username';
import { assignUniqueUsernameIfEmpty } from './assign-unique-username';

const avatarConfigArgs = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

type UsernameRow = {
  readonly username: string | null;
  readonly username_changed_at: string | null;
};

function avatarConfigJson(value: z.infer<typeof avatarConfigArgs>): string {
  const avatarConfig = parseAvatarConfig(value);
  if (avatarConfig === null) {
    throw new MutationError(
      'INVALID_AVATAR_CONFIG',
      'Avatar configuration is invalid.'
    );
  }
  return serializeAvatarConfig(avatarConfig);
}

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
    FROM profiles
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
  await tx.run(sql`
    INSERT INTO profiles (id, created_at, username, avatar_config)
    VALUES (${profileId}, ${now}, ${''}, ${avatarConfig})
    ON CONFLICT (id) DO NOTHING
  `);
}

export const ensureProfileMutation = defineMutation({
  name: 'ensureProfile',
  args: z.object({
    avatarConfig: avatarConfigArgs.optional(),
  }),
  writes: [PROFILES_TABLE],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  constraintErrors: {
    profiles_username_norm_uidx: {
      code: 'USERNAME_TAKEN',
      message: 'Username is taken.',
    },
  },
  async run({ tx, env }, { avatarConfig }) {
    await seedProfile(
      tx,
      env.actorId,
      env.now().toISOString(),
      avatarConfig === undefined
        ? serializeDefaultAvatarConfig(env.actorId)
        : avatarConfigJson(avatarConfig)
    );
    await assignUniqueUsernameIfEmpty(tx, env.actorId);
  },
});

export const applyEnsuredUsernameMutation = defineMutation({
  name: 'applyEnsuredUsername',
  args: z.object({ username: z.string().min(1) }),
  writes: [PROFILES_TABLE],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { username }) {
    const next = normalizeUsername(username);
    // Fill empty, or replace an auto-assigned name. Never overwrite a
    // user-chosen username (`username_changed_at` set). Do not compare
    // timestamptz to '' — Postgres rejects that cast.
    await tx.run(sql`
      UPDATE profiles
      SET username = ${next}
      WHERE id = ${env.actorId}
        AND (
          username = ''
          OR username IS NULL
          OR (
            username_changed_at IS NULL
            AND username != ${next}
          )
        )
    `);
  },
});

export const claimUsernameMutation = defineMutation({
  name: 'claimUsername',
  args: z.object({ username: z.string() }),
  writes: [PROFILES_TABLE],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  pendingUx: 'pending',
  requiresOnline: true,
  constraintErrors: {
    profiles_username_norm_uidx: {
      code: 'USERNAME_TAKEN',
      message: 'Username is taken.',
    },
  },
  async run({ tx, env }, { username: rawUsername }) {
    const username = normalizeUsername(rawUsername).toLowerCase();
    const validationError = validateUsername(username);
    if (validationError !== null) usernameFailure(validationError);
    const row = await getUsernameRow(tx, env.actorId);
    if (row.username === username) return;
    if (!canChangeUsername(row.username_changed_at, env.now().getTime())) {
      throw new MutationError(
        'USERNAME_COOLDOWN',
        'Username was changed recently.'
      );
    }
    await tx.run(sql`
      UPDATE profiles
      SET username = ${username}, username_changed_at = ${env.now().toISOString()}
      WHERE id = ${env.actorId}
    `);
  },
});

export const patchAvatarMutation = defineMutation({
  name: 'patchAvatar',
  args: z.object({ avatarConfig: avatarConfigArgs }),
  writes: [PROFILES_TABLE],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { avatarConfig }) {
    await tx.run(sql`
      UPDATE profiles
      SET avatar_config = ${avatarConfigJson(avatarConfig)}
      WHERE id = ${env.actorId}
    `);
  },
});

export const PROFILE_MUTATIONS = [
  ensureProfileMutation,
  applyEnsuredUsernameMutation,
  claimUsernameMutation,
  patchAvatarMutation,
] as const;
