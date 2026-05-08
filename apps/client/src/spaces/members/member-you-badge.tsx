import { useMemberIsYou } from '@gamezilla/client/spaces/use-member-is-you';
import { Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type MemberYouBadgeProps = {
  profileId: string;
};

/** "You" caption; renders nothing unless `profileId` is the current user. */
export function MemberYouBadge({
  profileId,
}: MemberYouBadgeProps): ReactNode {
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
