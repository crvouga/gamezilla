import { Trans } from '@lingui/solid/macro';
import { Text } from '@pkgs/ui';
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
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>You</Trans>}
      />
    </Show>
  );
}
