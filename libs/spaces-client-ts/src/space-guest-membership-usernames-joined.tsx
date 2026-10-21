import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipUsername } from './space-guest-membership-username';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestMembershipUsernamesJoinedProps = {
  spaceId: string;
};

const SEPARATOR = ', ';

/**
 * Comma-separated guest usernames for a space, one caption line. Each name
 * is its own atom; the separator is purely typographic glue between atoms.
 */
export function SpaceGuestMembershipUsernamesJoined(
  props: SpaceGuestMembershipUsernamesJoinedProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show when={membershipIds().length > 0}>
      <P variant="caption" lines={1}>
        <For each={membershipIds()}>
          {(mid, index) => (
            <>
              {index() > 0 ? SEPARATOR : null}
              <SpaceGuestMembershipUsername
                membershipId={mid}
                variant="caption"
              />
            </>
          )}
        </For>
      </P>
    </Show>
  );
}
