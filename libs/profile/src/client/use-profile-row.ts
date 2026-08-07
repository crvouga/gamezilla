import { useQueryOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { type ProfileRow, profileRowByIdSql } from './profile-row-sql';

export type { ProfileRow };

export type ProfileRowState = {
  row: ProfileRow | null;
  isLoading: boolean;
};

/**
 * Reads a single profile row by id. Used by editors that seed draft state
 * from the persisted row (avatar editor, username editor).
 */
export function useProfileRow(profileId: string | null): ProfileRowState {
  const enabled = profileId !== null && profileId.length > 0;
  const { row, isLoading } = useQueryOne(
    profileRowByIdSql(enabled ? profileId : '')
  );
  return {
    row: enabled ? (row ?? null) : null,
    isLoading: enabled && isLoading,
  };
}
