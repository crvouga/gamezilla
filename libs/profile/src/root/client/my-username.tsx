import { Handles } from '@libs/test-ids';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import type { ReactNode } from 'react';

import { useMyProfileId } from '../../public/use-my-profile-id';
import {
  UserUsername,
  type UserUsernameProps,
} from '../../public/user-username';

export type MyUsernameProps = Omit<UserUsernameProps, 'profileId' | 'testID'>;

/**
 * Sugar: `<UserUsername profileId={useMyProfileId()} … />` (SQLite only).
 * Returns null while the sync engine paint gate is closed so sticky
 * prior-identity rows do not flash the wrong handle.
 */
export function MyUsername({
  variant,
  sx,
  numberOfLines,
  withAt,
}: MyUsernameProps): ReactNode {
  const { paintReady } = useSyncEngine();
  const profileId = useMyProfileId();
  if (!paintReady) return null;
  return (
    <UserUsername
      profileId={profileId}
      testID={Handles.profileDisplayUsername}
      {...(variant !== undefined ? { variant } : {})}
      {...(sx !== undefined ? { sx } : {})}
      {...(numberOfLines !== undefined ? { numberOfLines } : {})}
      {...(withAt !== undefined ? { withAt } : {})}
    />
  );
}
