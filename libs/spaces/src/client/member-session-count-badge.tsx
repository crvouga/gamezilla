import { useMemberSessionCount } from './use-member-session-count';
import { Text } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type MemberSessionCountBadgeProps = {
  spaceId: string;
  profileId: string;
};

/**
 * `·N` badge showing how many tabs/devices the member is connected from.
 * Renders nothing when the count is 1 or fewer.
 */
export function MemberSessionCountBadge({
  spaceId,
  profileId,
}: MemberSessionCountBadgeProps): ReactNode {
  const count = useMemberSessionCount(spaceId, profileId);
  if (count <= 1) return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={`·${String(count)}`}
    />
  );
}
