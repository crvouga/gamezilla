import { optionalProps } from '@pkgs/ui/components/optional-props';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useProfileColumn, ProfileField } from './use-profile-column';

export type UserUsernameProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
  /** When true, prefix with `@`. Default true. */
  withAt?: boolean;
};

/**
 * Renders the persisted username for a profile id.
 * Returns `null` when no profile id is supplied; renders an empty `Text` when
 * the row hasn't synced (so layout positioning stays stable).
 */
export function UserUsername({
  profileId,
  variant,
  sx,
  numberOfLines,
  withAt = true,
}: UserUsernameProps): ReactNode {
  if (profileId === null) return null;
  return (
    <UserUsernameInner
      profileId={profileId}
      withAt={withAt}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}

function UserUsernameInner({
  profileId,
  variant,
  sx,
  numberOfLines,
  withAt,
}: {
  profileId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
  withAt: boolean;
}): ReactNode {
  const username = useProfileColumn(profileId, ProfileField.username);
  const label =
    username === null || username.length === 0
      ? ''
      : withAt
        ? `@${username}`
        : username;
  return (
    <Text {...optionalProps({ variant, sx, numberOfLines })} label={label} />
  );
}
