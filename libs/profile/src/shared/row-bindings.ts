import { PROFILES_TABLE, ProfileCol } from '@libs/db/shared/profile-tables';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

import {
  profilePatchWrite,
  type ProfilePatchInput,
} from './patch-avatar/profile-patch-write';

/**
 * Map an uploaded profile row change onto {@link profilePatchWrite} input so
 * upload authorization reuses the same `authorize` as client `runClientWrite`.
 */
export function rowToProfilePatchInput(
  row: RowChange
): WriteResult<ProfilePatchInput> {
  if (row.op === 'delete') {
    return fail('PROFILE_DELETE_DENIED', 'profiles cannot be deleted via sync');
  }
  const values = row.values ?? {};
  const avatarConfig = values[ProfileCol.avatarConfig];
  return ok({
    profileId: row.id,
    ...(typeof avatarConfig === 'string' ? { avatarConfig } : {}),
  });
}

export const PROFILE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [PROFILES_TABLE.tableName]: createRowWriteBinding(
    profilePatchWrite,
    rowToProfilePatchInput
  ) as unknown as RowWriteBinding<RowChange>,
};
