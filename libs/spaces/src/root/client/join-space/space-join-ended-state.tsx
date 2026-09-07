import { useProfileRow } from '@libs/profile/public/use-profile-row';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState, Gamepad2Icon, useBreadcrumbNav } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { useSpaceHostMembershipDisplay } from '../../../root/client/members/use-space-host-membership-display';
import { useSpaceCommandLabel } from '../../../root/client/use-space-command-label';

export type SpaceJoinEndedStateProps = {
  spaceId: string;
};

/** Terminal empty state for a space that has already ended. */
export function SpaceJoinEndedState(
  props: SpaceJoinEndedStateProps
): JSX.Element {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  const spaceLabel = useSpaceCommandLabel(props.spaceId);
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const hostProfileId = createMemo(() => {
    const id = host()?.profileId;
    return id !== undefined && id.length > 0 ? id : null;
  });
  const hostRow = useProfileRow(hostProfileId);
  const body = createMemo(() => {
    const username = hostRow.row()?.username ?? null;
    const label = spaceLabel();
    if (username !== null && username.length > 0) {
      return t`${label} · hosted by ${username}`;
    }
    return label;
  });

  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={<Trans>This space has ended</Trans>}
      body={body()}
      action={{ label: t`Back to Spaces`, onClick: nav('/') }}
    />
  );
}
