import { UserUsername } from '@libs/profile-client/user-username';
import type { TextVariant } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostNameTextProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
  numberOfLines?: number;
};

export function SpaceHostNameText(props: SpaceHostNameTextProps): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <UserUsername
      profileId={host()?.profileId ?? null}
      withAt={false}
      variant={props.variant}
      class={props.class}
      numberOfLines={props.numberOfLines}
    />
  );
}
