import { useLingui } from '@lingui/react/macro';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useSpaceMemberCount } from '../members/use-space-member-count';

export type MiniplayerMemberCountTextProps = {
  spaceId: string;
};

/** "N people here" caption inside a miniplayer card. */
export function MiniplayerMemberCountText({
  spaceId,
}: MiniplayerMemberCountTextProps): ReactNode {
  const { t } = useLingui();
  const count = useSpaceMemberCount(spaceId);
  return (
    <Text variant="caption" numberOfLines={1} label={t`${count} people here`} />
  );
}
