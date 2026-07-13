import { UserUsername } from '@libs/profile/client/user-username';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { SxProps, TextVariant } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';

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
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  return (
    <UserUsername
      profileId={hostId}
      withAt={false}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
