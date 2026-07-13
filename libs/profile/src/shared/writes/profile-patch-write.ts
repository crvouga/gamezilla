import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';

export type ProfilePatchInput = {
  readonly profileId: string;
  readonly avatarConfig?: string;
};

function parseProfilePatchInput(
  raw: unknown
): ReturnType<typeof ok<ProfilePatchInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'profile patch input must be an object');
  }
  const record = raw as Record<string, unknown>;
  const profileId = record['profileId'];
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return fail('INVALID_INPUT', 'profileId is required');
  }
  const avatarConfig = record['avatarConfig'];
  const input = {
    profileId,
    ...(typeof avatarConfig === 'string' ? { avatarConfig } : {}),
  } satisfies ProfilePatchInput;
  return ok(input);
}

export const profilePatchWrite = defineWrite<ProfilePatchInput, void>({
  name: 'profile.patch',
  parseInput: parseProfilePatchInput,
  authorize: async (ctx, input) => {
    const idError = idMatches(input.profileId, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    return ok(undefined);
  },
  execute: async (_ctx, input, store) => {
    const updates: Record<string, string> = {};
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
