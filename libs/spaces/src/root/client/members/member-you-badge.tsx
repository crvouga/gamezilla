import { Trans } from '@lingui/react/macro';
import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { useMemberIsYou } from './use-member-is-you';

export type MemberYouBadgeProps = {
  profileId: string;
};

/** "You" caption; renders nothing unless the seat is this install. */
export function MemberYouBadge({ profileId }: MemberYouBadgeProps): ReactNode {
  const isYou = useMemberIsYou(profileId);
  if (!isYou) return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={<Trans>You</Trans>}
    />
  );
}
