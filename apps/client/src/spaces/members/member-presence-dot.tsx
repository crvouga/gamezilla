import { useMemberIsOnline } from '@gamezilla/client/spaces/use-member-is-online';
import { StatusDot } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type MemberPresenceDotProps = {
  spaceId: string;
  profileId: string;
  size: number;
};

/** Online dot for a member; renders nothing when offline. */
export function MemberPresenceDot({
  spaceId,
  profileId,
  size,
}: MemberPresenceDotProps): ReactNode {
  const online = useMemberIsOnline(spaceId, profileId);
  if (!online) return null;
  return <StatusDot status="online" size={size} />;
}
