import { profileRowByIdSql } from '@libs/profile-shared/profile-row-sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

export const ProfileField = {
  username: 'username',
  avatarConfig: 'avatar_config',
  createdAt: 'created_at',
  accountKind: 'account_kind',
} as const satisfies Record<string, string>;

export type ProfileFieldKey = keyof typeof ProfileField;

/**
 * Profile column for `profileId`. Uses {@link createQuery} (same display/cache
 * path as other account UI). Pass an accessor so the id stays reactive.
 */
export function useProfileColumn(
  profileId: Accessor<string>,
  field: ProfileFieldKey
): Accessor<string | null> {
  const column = ProfileField[field];
  const { rows } = createQuery(() => profileRowByIdSql(profileId()));
  return createMemo(() => {
    const row = rows()[0] ?? null;
    if (row === null) return null;
    const value = row[column];
    if (typeof value !== 'string') return null;
    return value;
  });
}
