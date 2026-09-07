import { UserUsername } from '@libs/profile/public/user-username';
import type { SxProps, TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostNameTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

export function SpaceHostNameText(props: SpaceHostNameTextProps): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <UserUsername
      profileId={host()?.profileId ?? null}
      withAt={false}
      variant={props.variant}
      sx={props.sx}
      numberOfLines={props.numberOfLines}
    />
  );
}
