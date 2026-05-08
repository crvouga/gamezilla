import { useSpaceMemberCount } from '@gamezilla/client/spaces/members/use-space-member-count';
import { Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type MiniplayerMemberCountTextProps = {
  spaceId: string;
};

/* eslint-disable-next-line lingui/no-unlocalized-strings -- color token */
const SUBTITLE_COLOR = 'rgba(255,255,255,0.85)';

/** "N people here" caption inside a miniplayer card. */
export function MiniplayerMemberCountText({
  spaceId,
}: MiniplayerMemberCountTextProps): ReactNode {
  const { t } = useLingui();
  const count = useSpaceMemberCount(spaceId);
  return (
    <Text
      variant="caption"
      numberOfLines={1}
      sx={{ color: SUBTITLE_COLOR }}
      label={t`${count} people here`}
    />
  );
}
