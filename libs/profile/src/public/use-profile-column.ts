import { createQuery } from '@pkgs/sync-engine/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import { profileRowByIdSql } from './profile-row-sql';

export const ProfileField = {
  username: 'username',
  avatarConfig: 'avatar_config',
  createdAt: 'created_at',
} as const satisfies Record<string, string>;

export type ProfileFieldKey = keyof typeof ProfileField;

/**
 * Profile column for `profileId`. Uses {@link createQuery} (same display/cache
 * path as other account UI).
 */
export function useProfileColumn(
  profileId: string,
  field: ProfileFieldKey
): Accessor<string | null> {
  const column = ProfileField[field];
  const { rows } = createQuery(() => profileRowByIdSql(profileId));
  return createMemo(() => {
    const row = rows()[0] ?? null;
    if (row === null) return null;
    const value = row[column];
    if (typeof value !== 'string') return null;
    return value;
  });
}
