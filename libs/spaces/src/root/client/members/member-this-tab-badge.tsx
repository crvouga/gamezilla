import { Trans } from '@lingui/solid/macro';
import { Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMemberIsThisTab } from './use-member-is-this-tab';

export type MemberThisTabBadgeProps = {
  spaceId: string;
  profileId: string;
};

/** "This tab" caption; renders nothing unless the active connection is here. */
export function MemberThisTabBadge(
  props: MemberThisTabBadgeProps
): JSX.Element {
  const isThisTab = useMemberIsThisTab(props.spaceId, props.profileId);
  return (
    <Show when={isThisTab()}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>This tab</Trans>}
      />
    </Show>
  );
}
