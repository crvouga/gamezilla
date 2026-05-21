import { optionalProps } from '@pkgs/ui/components/optional-props';
import { PROFILE_ENTITY_TYPE, ProfileAttr } from '../shared/profile-entities';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import type { ReactNode } from 'react';

export type UserDisplayNameProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Renders the persisted `profile/display-name` for a profile id.
 * Returns `null` when no profile id is supplied; renders an empty `Text` when
 * the row hasn't synced (so layout positioning stays stable).
 */
export function UserDisplayName({
  profileId,
  variant,
  sx,
  numberOfLines,
}: UserDisplayNameProps): ReactNode {
  if (profileId === null) return null;
  return (
    <UserDisplayNameInner
      profileId={profileId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}

function UserDisplayNameInner({
  profileId,
  variant,
  sx,
  numberOfLines,
}: {
  profileId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
}): ReactNode {
  const displayName = useQueryAttribute({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileId,
    attribute: ProfileAttr.displayName,
  });
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={displayName}
    />
  );
}
