import type { SxProps, TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { NoGuestsText } from './no-guests-text';
import { SpaceGuestMembershipUsernamesJoined } from './space-guest-membership-usernames-joined';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestNamesLineProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Single-line summary of a space's guests: shows the joined names list when
 * there are guests, otherwise a localized "No guests yet" placeholder.
 */
export function SpaceGuestNamesLine(
  props: SpaceGuestNamesLineProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show
      when={membershipIds().length > 0}
      fallback={
        <NoGuestsText
          {...(props.variant !== undefined ? { variant: props.variant } : {})}
          {...(props.sx !== undefined ? { sx: props.sx } : {})}
          {...(props.numberOfLines !== undefined
            ? { numberOfLines: props.numberOfLines }
            : {})}
        />
      }
    >
      <SpaceGuestMembershipUsernamesJoined
        spaceId={props.spaceId}
        {...(props.variant !== undefined ? { variant: props.variant } : {})}
        {...(props.sx !== undefined ? { sx: props.sx } : {})}
        {...(props.numberOfLines !== undefined
          ? { numberOfLines: props.numberOfLines }
          : {})}
      />
    </Show>
  );
}
