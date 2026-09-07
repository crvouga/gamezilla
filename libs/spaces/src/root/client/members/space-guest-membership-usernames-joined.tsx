import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipUsername } from './space-guest-membership-username';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestMembershipUsernamesJoinedProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

const SEPARATOR = ', ';

/**
 * Comma-separated guest usernames for a space. Each name is its own atom;
 * the separator is purely typographic glue between atoms.
 */
export function SpaceGuestMembershipUsernamesJoined(
  props: SpaceGuestMembershipUsernamesJoinedProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show when={membershipIds().length > 0}>
      <Text
        variant={props.variant}
        sx={props.sx}
        numberOfLines={props.numberOfLines}
      >
        <For each={membershipIds()}>
          {(mid, index) => (
            <>
              {index() > 0 ? SEPARATOR : null}
              <SpaceGuestMembershipUsername
                membershipId={mid}
                {...(props.variant !== undefined
                  ? { variant: props.variant }
                  : {})}
              />
            </>
          )}
        </For>
      </Text>
    </Show>
  );
}
