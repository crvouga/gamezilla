import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import type { ProfileRow } from '@libs/profile-shared/profile-row-sql';
import { profileRowByIdSql } from '@libs/profile-shared/profile-row-sql';

export type ProfileRowState = {
  row: Accessor<ProfileRow | null>;
  isLoading: Accessor<boolean>;
};

/**
 * Reads a single profile row by id. Used by editors that seed draft state
 * from the persisted row (avatar editor, username editor).
 */
export function useProfileRow(
  profileId: Accessor<string | null>
): ProfileRowState {
  const enabled = createMemo(() => {
    const id = profileId();
    return id !== null && id.length > 0;
  });
  const { rows, isLoading } = createQuery(() => {
    const id = profileId();
    return profileRowByIdSql(id !== null && id.length > 0 ? id : '');
  });
  const row = createMemo(() => {
    if (!enabled()) return null;
    return rows()[0] ?? null;
  });
  const loading = createMemo(() => enabled() && isLoading());
  return {
    row,
    isLoading: loading,
  };
}
