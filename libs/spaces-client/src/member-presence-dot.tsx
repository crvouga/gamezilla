import { StatusDot } from '@pkgs/ui-client/status-dot';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMemberIsOnline } from './use-member-is-online';

export type MemberPresenceDotProps = {
  spaceId: string;
  profileId: string;
  size: number;
};

/** Online dot for a member; renders nothing when offline. */
export function MemberPresenceDot(props: MemberPresenceDotProps): JSX.Element {
  const online = useMemberIsOnline(props.spaceId, props.profileId);
  return (
    <Show when={online()}>
      <StatusDot status="online" size={props.size} />
    </Show>
  );
}
