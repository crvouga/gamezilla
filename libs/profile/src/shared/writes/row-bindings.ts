import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { idMatches, readRowString } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

import { canChangeUsername, validateUsername } from '../username';

function validateProfileUsernameRow(
  row: Parameters<typeof readRowString>[0]
): ReturnType<typeof fail> | null {
  const username = readRowString(row, ProfileCol.username);
  if (username === undefined || username.length === 0) return null;
  const error = validateUsername(username);
  if (error !== null) {
    return fail(`PROFILE_USERNAME_${error.toUpperCase()}`, `profile username ${error}`);
  }
  const changedAt = readRowString(row, ProfileCol.usernameChangedAt);
  if (changedAt !== undefined && !canChangeUsername(changedAt)) {
    return fail('PROFILE_USERNAME_COOLDOWN', 'profile username change cooldown');
  }
  return null;
}

const profilePatchRowWrite = defineRowAuthorizeWrite({
  name: 'profile.patch',
  authorize: async (ctx, row) => {
    const idError = idMatches(row.id, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    const usernameError = validateProfileUsernameRow(row);
    if (usernameError !== null) return usernameError;
    return ok(undefined);
  },
});

export const PROFILE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [PROFILES_TABLE.tableName]: createRowWriteBinding(profilePatchRowWrite),
};
