import { UserUsername } from '@libs/profile-client/user-username';
import type { TextRole } from '@pkgs/ui-root-client/text';
import type { TextLines } from '@pkgs/ui-root-client/text-classes';
import type { JSX } from 'solid-js';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostNameTextProps = {
  spaceId: string;
  variant?: TextRole;
  numberOfLines?: TextLines;
};

export function SpaceHostNameText(props: SpaceHostNameTextProps): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <UserUsername
      profileId={host()?.profileId ?? null}
      withAt={false}
      variant={props.variant}
      numberOfLines={props.numberOfLines}
    />
  );
}
