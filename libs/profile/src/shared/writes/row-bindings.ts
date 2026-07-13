import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { idMatches } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

const profilePatchRowWrite = defineRowAuthorizeWrite({
  name: 'profile.patch',
  authorize: async (ctx, row) => {
    const idError = idMatches(row.id, ctx.myId, 'PROFILE_ID_MISMATCH');
    if (idError !== null) return idError;
    return ok(undefined);
  },
});

export const PROFILE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [PROFILES_TABLE.tableName]: createRowWriteBinding(profilePatchRowWrite),
};
