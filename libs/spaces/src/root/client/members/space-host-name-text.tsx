import { UserUsername } from '@libs/profile/public/user-username';
import type { SxProps, TextVariant } from '@pkgs/ui-rn';
import { optionalProps } from '@pkgs/ui-rn/components/optional-props';
import type { ReactNode } from 'react';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostNameTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

export function SpaceHostNameText({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceHostNameTextProps): ReactNode {
  const host = useSpaceHostMembershipDisplay(spaceId);
  return (
    <UserUsername
      profileId={host?.profileId ?? null}
      withAt={false}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
