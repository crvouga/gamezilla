import { Trans } from '@lingui/solid/macro';
import { Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMemberRole } from './use-member-role';

export type MemberHostBadgeProps = {
  spaceId: string;
  profileId: string;
};

/** "Host" caption; renders nothing unless `profileId` is the host. */
export function MemberHostBadge(props: MemberHostBadgeProps): JSX.Element {
  const role = useMemberRole(props.spaceId, props.profileId);
  return (
    <Show when={role() === 'host'}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Host</Trans>}
      />
    </Show>
  );
}
