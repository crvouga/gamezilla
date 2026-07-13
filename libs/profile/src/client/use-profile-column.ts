import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

import { ProfileCol } from '@libs/db/shared/profile-tables';

import { PROFILE_ROW_BY_ID_SQL } from './profile-row-sql';

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
  const { value } = useWatchField<string>(
    PROFILE_ROW_BY_ID_SQL,
    [profileId],
    col
  );
  return value;
}
