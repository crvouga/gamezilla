import { useSpaceCommandLabel } from '../use-space-command-label';
import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';
import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { EmptyState, Gamepad2Icon } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

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
