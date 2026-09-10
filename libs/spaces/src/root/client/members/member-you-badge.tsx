import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMemberIsYou } from './use-member-is-you';

export type MemberYouBadgeProps = {
  profileId: string;
};

/** "You" caption; renders nothing unless the seat is this install. */
export function MemberYouBadge(props: MemberYouBadgeProps): JSX.Element {
  const isYou = useMemberIsYou(props.profileId);
  return (
    <Show when={isYou()}>
      <p class="text textCaption text-text-secondary">{<Trans>You</Trans>}</p>
    </Show>
  );
}
