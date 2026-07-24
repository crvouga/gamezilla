import type { ReactNode } from 'react';

import { useMyProfileId } from './use-my-profile-id';
import { UserUsername, type UserUsernameProps } from './user-username';

export type MyUsernameProps = Omit<UserUsernameProps, 'profileId'>;

/** Sugar: `<UserUsername profileId={useMyProfileId()} … />` (SQLite only). */
export function MyUsername({
  variant,
  sx,
  numberOfLines,
  withAt,
}: MyUsernameProps): ReactNode {
  const profileId = useMyProfileId();
  return (
    <UserUsername
      profileId={profileId}
      {...(variant !== undefined ? { variant } : {})}
      {...(sx !== undefined ? { sx } : {})}
      {...(numberOfLines !== undefined ? { numberOfLines } : {})}
      {...(withAt !== undefined ? { withAt } : {})}
    />
  );
}
