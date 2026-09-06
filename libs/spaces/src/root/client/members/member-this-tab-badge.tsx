import { Trans } from '@lingui/react/macro';
import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { useMemberIsThisTab } from './use-member-is-this-tab';

export type MemberThisTabBadgeProps = {
  spaceId: string;
  profileId: string;
};

/** "This tab" caption; renders nothing unless the active connection is here. */
export function MemberThisTabBadge({
  spaceId,
  profileId,
}: MemberThisTabBadgeProps): ReactNode {
  const isThisTab = useMemberIsThisTab(spaceId, profileId);
  if (!isThisTab) return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={<Trans>This tab</Trans>}
    />
  );
}
