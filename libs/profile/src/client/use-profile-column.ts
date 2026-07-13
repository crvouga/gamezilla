import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

export const ProfileField = {
  username: 'username',
  avatarConfig: 'avatarConfig',
  createdAt: 'createdAt',
} as const satisfies Record<string, keyof typeof ProfileCol>;

export type ProfileFieldKey = keyof typeof ProfileField;

export function useProfileColumn(
  profileId: string,
  field: ProfileFieldKey
): string | null {
  const col = ProfileCol[field];
  const { value } = useWatchValue<string>(
    `SELECT ${col} AS value FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ?`,
    [profileId]
  );
  return value;
}
