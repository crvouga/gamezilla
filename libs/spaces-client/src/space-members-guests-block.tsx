import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipTileRail } from './space-guest-membership-tile-rail';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceMembersGuestsBlockProps = {
  spaceId: string;
};

/** Section showing each guest's tile, or a "no guests yet" placeholder. */
export function SpaceMembersGuestsBlock(
  props: SpaceMembersGuestsBlockProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <div class="box gap-1">
      <label class="text textLabel text-text-secondary px-2">
        {<Trans>Guests</Trans>}
      </label>
      <div class="box gap-0">
        <Show
          when={membershipIds().length > 0}
          fallback={
            <p class="text textCaption text-text-secondary px-2">
              {<Trans>No guests yet</Trans>}
            </p>
          }
        >
          <For each={membershipIds()}>
            {(mid) => (
              <SpaceGuestMembershipTileRail
                spaceId={props.spaceId}
                membershipId={mid}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
