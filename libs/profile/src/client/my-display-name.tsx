import { useMyProfileId } from './use-my-profile-id';
import { UserDisplayName } from './user-display-name';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import type { SxProps, TextVariant } from '@gamezilla/ui';
import type { ReactNode } from 'react';

export type MyDisplayNameProps = {
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/** Sugar: `<UserDisplayName profileId={useMyProfileId()} … />`. */
export function MyDisplayName({
  variant,
  sx,
  numberOfLines,
}: MyDisplayNameProps): ReactNode {
  const profileId = useMyProfileId();
  return (
    <UserDisplayName
      profileId={profileId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
