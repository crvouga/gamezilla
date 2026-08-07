import { useQuery } from '@pkgs/sync-engine/client/sync-engine-context';

import { profileRowByIdSql } from './profile-row-sql';

export const ProfileField = {
  username: 'username',
  avatarConfig: 'avatar_config',
  createdAt: 'created_at',
} as const satisfies Record<string, string>;

export type ProfileFieldKey = keyof typeof ProfileField;

/**
 * Profile column for `profileId`. Uses {@link useQuery} (same display/cache
 * path as other account UI).
 */
export function useProfileColumn(
  profileId: string,
  field: ProfileFieldKey
): string | null {
  const column = ProfileField[field];
  const { rows } = useQuery(profileRowByIdSql(profileId));
  const row = rows[0] ?? null;
  if (row === null) return null;
  const value = row[column];
  if (typeof value !== 'string') return null;
  return value;
}
