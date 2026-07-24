import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { ProfileCol } from '@libs/db/shared/profile-tables';

import { PROFILE_ROW_BY_ID_SQL } from './profile-row-sql';

export const ProfileField = {
  username: 'username',
  avatarConfig: 'avatarConfig',
  createdAt: 'createdAt',
} as const satisfies Record<string, keyof typeof ProfileCol>;

export type ProfileFieldKey = keyof typeof ProfileField;

type ProfileRow = Readonly<Record<string, unknown>>;

/**
 * Profile column for `profileId`. Uses {@link useWatchOne} (same display/cache
 * path as other account UI) so account switches do not leave the Profile tab
 * username stuck on an empty `useWatchField` snapshot.
 */
export function useProfileColumn(
  profileId: string,
  field: ProfileFieldKey
): string | null {
  const col = ProfileCol[field];
  const { row } = useWatchOne<ProfileRow>(PROFILE_ROW_BY_ID_SQL, [profileId]);
  if (row === null) return null;
  const raw = row[col];
  if (typeof raw !== 'string') return null;
  return raw;
}
