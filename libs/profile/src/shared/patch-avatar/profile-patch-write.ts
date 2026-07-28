import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { honey } from '@pkgs/sql';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches } from '@pkgs/write/shared/read-row-values';

export type ProfilePatchInput = {
  readonly profileId: string;
  readonly avatarConfig?: string;
};

function parseProfilePatchInput(
  input: unknown
): ReturnType<typeof ok<ProfilePatchInput>> | ReturnType<typeof fail> {
  if (input === null || typeof input !== 'object') {
    return fail('INVALID_INPUT', 'profile patch input must be an object');
  }
  const record = input as Record<string, unknown>;
  const profileId = record['profileId'];
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return fail('INVALID_INPUT', 'profileId is required');
  }
  const avatarConfig = record['avatarConfig'];
  const parsed = {
    profileId,
    ...(typeof avatarConfig === 'string' ? { avatarConfig } : {}),
  } satisfies ProfilePatchInput;
  return ok(parsed);
}

export const profilePatchWrite = defineWrite<ProfilePatchInput, void>({
  name: 'profile.patch',
  parseInput: parseProfilePatchInput,
  authorize: async (ctx, input) => {
    const idError = idMatches(input.profileId, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    return ok(undefined);
  },
  execute: async (_ctx, input, db) => {
    const updates: Record<string, string> = {};
    if (input.avatarConfig !== undefined) {
      updates[ProfileCol.avatarConfig] = input.avatarConfig;
    }
    if (Object.keys(updates).length === 0) {
      return ok(undefined);
    }
    await db.run(
      honey({
        update: PROFILES_TABLE.tableName,
        set: updates,
        where: ['=', ProfileCol.id, input.profileId],
      })
    );
    return ok(undefined);
  },
});
