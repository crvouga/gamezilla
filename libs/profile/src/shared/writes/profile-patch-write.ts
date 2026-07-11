import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';

import { canChangeUsername, normalizeUsername, validateUsername } from '../username';

export type ProfilePatchInput = {
  readonly profileId: string;
  readonly displayName?: string;
  readonly username?: string;
  readonly usernameChangedAt?: string;
  readonly avatarConfig?: string;
};

function parseProfilePatchInput(raw: unknown): ReturnType<typeof ok<ProfilePatchInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'profile patch input must be an object');
  }
  const record = raw as Record<string, unknown>;
  const profileId = record['profileId'];
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return fail('INVALID_INPUT', 'profileId is required');
  }
  const displayName = record['displayName'];
  const username = record['username'];
  const usernameChangedAt = record['usernameChangedAt'];
  const avatarConfig = record['avatarConfig'];
  const input = {
    profileId,
    ...(typeof displayName === 'string' ? { displayName } : {}),
    ...(typeof username === 'string' ? { username } : {}),
    ...(typeof usernameChangedAt === 'string' ? { usernameChangedAt } : {}),
    ...(typeof avatarConfig === 'string' ? { avatarConfig } : {}),
  } satisfies ProfilePatchInput;
  return ok(input);
}

export const profilePatchWrite = defineWrite<ProfilePatchInput, void>({
  name: 'profile.patch',
  parseInput: parseProfilePatchInput,
  authorize: async (ctx, input, store) => {
    const idError = idMatches(input.profileId, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    if (input.username !== undefined) {
      const username = normalizeUsername(input.username);
      const validationError = validateUsername(username);
      if (validationError !== null) {
        return fail(`PROFILE_USERNAME_${validationError.toUpperCase()}`, validationError);
      }
      if (input.usernameChangedAt !== undefined) {
        if (!canChangeUsername(input.usernameChangedAt)) {
          return fail('PROFILE_USERNAME_COOLDOWN', 'username change cooldown');
        }
      } else {
        const rows = await store.query<{ readonly username_changed_at: string | null }>(
          `SELECT ${ProfileCol.usernameChangedAt} FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ? LIMIT 1`,
          [input.profileId]
        );
        const row = rows[0];
        if (row !== undefined && !canChangeUsername(row.username_changed_at)) {
          return fail('PROFILE_USERNAME_COOLDOWN', 'username change cooldown');
        }
      }
    }
    return ok(undefined);
  },
  execute: async (_ctx, input, store) => {
    const updates: Record<string, string> = {};
    if (input.displayName !== undefined) {
      updates[ProfileCol.displayName] = input.displayName;
    }
    if (input.username !== undefined) {
      updates[ProfileCol.username] = normalizeUsername(input.username);
    }
    if (input.usernameChangedAt !== undefined) {
      updates[ProfileCol.usernameChangedAt] = input.usernameChangedAt;
    }
    if (input.avatarConfig !== undefined) {
      updates[ProfileCol.avatarConfig] = input.avatarConfig;
    }
    if (Object.keys(updates).length === 0) {
      return ok(undefined);
    }
    const entries = Object.entries(updates);
    const sets = entries.map(([col]) => `${col} = ?`).join(', ');
    await store.run(
      `UPDATE ${PROFILES_TABLE.tableName} SET ${sets} WHERE ${ProfileCol.id} = ?`,
      [...entries.map(([, v]) => v), input.profileId]
    );
    return ok(undefined);
  },
});
