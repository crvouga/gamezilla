import {
  ProfileField,
  useProfileColumn,
} from '@libs/profile/public/use-profile-column';
import { Trans, useLingui } from '@lingui/react/macro';
import { EmptyState, Gamepad2Icon } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import type { ReactNode } from 'react';
import { useSpaceHostMembershipDisplay } from '../../../root/client/members/use-space-host-membership-display';
import { useSpaceCommandLabel } from '../../../root/client/use-space-command-label';

export type SpaceJoinEndedStateProps = {
  spaceId: string;
};

/** Terminal empty state for a space that has already ended. */
export function SpaceJoinEndedState({
  spaceId,
}: SpaceJoinEndedStateProps): ReactNode {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  const spaceLabel = useSpaceCommandLabel(spaceId);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostUsername = useProfileColumn(
    host?.profileId ?? '',
    ProfileField.username
  );
  const body =
    hostUsername !== null && hostUsername.length > 0
      ? t`${spaceLabel} · hosted by ${hostUsername}`
      : spaceLabel;

  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={<Trans>This space has ended</Trans>}
      body={body}
      action={{ label: t`Back to Spaces`, onPress: nav('/') }}
    />
  );
}
