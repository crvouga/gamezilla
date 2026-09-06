import { createQuery } from '@pkgs/sync-engine/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import {
  type ProfileRow,
  profileRowByIdSql,
} from '../../../shared/profile/profile-row-sql';

export type { ProfileRow };

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
  return {
    row,
    isLoading: createMemo(() => enabled() && isLoading()),
  };
}
