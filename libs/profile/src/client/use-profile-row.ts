import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

export type ProfileRow = {
  readonly id: string;
  readonly created_at: string | null;
  readonly display_name: string | null;
  readonly username: string | null;
  readonly username_changed_at: string | null;
  readonly avatar_config: string | null;
};

export type ProfileRowState = {
  row: ProfileRow | null;
  isLoading: boolean;
};

/**
 * Reads a single profile row by id. Used by editors that seed draft state
 * from the persisted row (avatar editor, display-name editor).
 */
export function useProfileRow(profileId: string | null): ProfileRowState {
  const enabled = profileId !== null && profileId.length > 0;
  const { row, isLoading } = useWatchOne<ProfileRow>(
    `SELECT ${ProfileCol.id}, ${ProfileCol.createdAt}, ${ProfileCol.displayName},
            ${ProfileCol.username}, ${ProfileCol.usernameChangedAt}, ${ProfileCol.avatarConfig}
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} = ?`,
    enabled ? [profileId] : ['']
  );
  return { row: enabled ? (row ?? null) : null, isLoading: enabled && isLoading };
}
