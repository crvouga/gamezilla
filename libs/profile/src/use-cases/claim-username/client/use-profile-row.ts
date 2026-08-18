import { useQuery } from '@pkgs/sync-engine/client';

import {
  type ProfileRow,
  profileRowByIdSql,
} from '../../../shared/profile/profile-row-sql';

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
  const { rows, isLoading } = useQuery(
    profileRowByIdSql(enabled ? profileId : '')
  );
  const row = rows[0] ?? null;
  return {
    row: enabled ? row : null,
    isLoading: enabled && isLoading,
  };
}
