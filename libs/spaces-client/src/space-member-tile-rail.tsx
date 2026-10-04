import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { MemberPresenceBadgesRow } from './member-presence-badges-row';
import { MemberPresenceDot } from './member-presence-dot';
import { MemberThisTabHighlight } from './member-this-tab-highlight';

export type SpaceMemberTileRailProps = {
  spaceId: string;
  /** Install seat id (presence / You / Host badges). */
  deviceId: string;
  /** Profile id for avatar/username. */
  profileId: string;
  deviceLabel?: string | null;
};

const RAIL_RADIUS = 10;
const AVATAR_SIZE = 40;
const ONLINE_DOT_SIZE = 8;

/** Rail-style member tile keyed by device seat + profile display. */
export function SpaceMemberTileRail(
  props: SpaceMemberTileRailProps
): JSX.Element {
  return (
    <MemberThisTabHighlight
      spaceId={props.spaceId}
      profileId={props.deviceId}
      borderRadius={RAIL_RADIUS}
    >
      <div class="box flex-row items-center gap-2 px-2 py-2">
        <div class="box flex-row items-center gap-1">
          <MemberPresenceDot
            spaceId={props.spaceId}
            profileId={props.deviceId}
            size={ONLINE_DOT_SIZE}
          />
          <UserProfileAvatar profileId={props.profileId} size={AVATAR_SIZE} />
        </div>
        <div class="box flex-1 min-w-0 gap-1">
          <UserUsername
            profileId={props.profileId}
            withAt={false}
            variant="body"
            numberOfLines={1}
          />
          <Show when={(props.deviceLabel ?? '').length > 0}>
            <p class="text textCaption line-clamp-1 text-text-secondary">
              {props.deviceLabel ?? ''}
            </p>
          </Show>
          <MemberPresenceBadgesRow
            spaceId={props.spaceId}
            profileId={props.deviceId}
          />
        </div>
      </div>
    </MemberThisTabHighlight>
  );
}
