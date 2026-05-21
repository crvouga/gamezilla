import { useMemberRole } from './use-member-role';
import { Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type MemberHostBadgeProps = {
  spaceId: string;
  profileId: string;
};

/** "Host" caption; renders nothing unless `profileId` is the host. */
export function MemberHostBadge({
  spaceId,
  profileId,
}: MemberHostBadgeProps): ReactNode {
  const role = useMemberRole(spaceId, profileId);
  if (role !== 'host') return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={<Trans>Host</Trans>}
    />
  );
}
