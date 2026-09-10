import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { SpaceMemberTileRail } from './space-member-tile-rail';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceMembersHostBlockProps = {
  spaceId: string;
};

export function SpaceMembersHostBlock(
  props: SpaceMembersHostBlockProps
): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <div class="box gap-1">
      <label class="text textLabel text-text-secondary px-2">
        {<Trans>Host</Trans>}
      </label>
      <div class="box gap-0">
        <Show
          when={host()}
          keyed
          fallback={
            <p class="text textCaption text-text-secondary px-2">
              {<Trans>No host listed</Trans>}
            </p>
          }
        >
          {(entry) => (
            <SpaceMemberTileRail
              spaceId={props.spaceId}
              deviceId={entry.deviceId}
              profileId={entry.profileId}
              deviceLabel={entry.deviceLabel}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
