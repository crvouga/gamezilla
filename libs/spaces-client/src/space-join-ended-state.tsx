import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client/icons';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { useSpaceCommandLabel } from './use-space-command-label';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

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
  const moderation = useModeration();
  const body = createMemo(() => {
    const id = hostProfileId();
    const username =
      id === null
        ? ''
        : usernameText(moderation(), hostRow.row()?.username, id);
    const label = spaceLabel();
    if (username.length > 0) {
      return t`${label}, hosted by ${username}`;
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
