import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { SpaceMemberTileRail } from './space-member-tile-rail';

export type SpaceGuestMembershipTileRailProps = {
  spaceId: string;
  /** Guest member / account id (also the profile id). */
  membershipId: string;
};

export function SpaceGuestMembershipTileRail(
  props: SpaceGuestMembershipTileRailProps
): JSX.Element {
  return (
    <Show when={props.membershipId.length > 0}>
      <SpaceMemberTileRail
        spaceId={props.spaceId}
        deviceId={props.membershipId}
        profileId={props.membershipId}
        deviceLabel={null}
      />
    </Show>
  );
}
