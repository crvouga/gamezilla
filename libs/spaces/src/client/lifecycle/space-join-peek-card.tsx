import { Box, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { SpacePeekDto } from '../spaces-actions';
import { SPACE_CARD_BORDER_RADIUS } from '../card/space-card-gradient';

export type SpaceJoinPeekCardProps = {
  readonly peek: SpacePeekDto;
};

export function SpaceJoinPeekCard({
  peek,
}: SpaceJoinPeekCardProps): ReactNode {
  const { t } = useLingui();
  const hostUsername = peek.hostUsername ?? '';
  const memberCount = peek.activeMemberCount;
  const title =
    peek.title !== null && peek.title.length > 0
      ? peek.title
      : hostUsername.length > 0
        ? t`@${hostUsername}'s space`
        : t`Space`;
  const hostLabel = hostUsername.length > 0 ? t`@${hostUsername}` : null;
  const memberLabel = t`${memberCount} live`;

  return (
    <Box
      sx={{
        borderRadius: SPACE_CARD_BORDER_RADIUS,
        p: 4,
        gap: 2,
        backgroundColor: 'surfaceSecondary',
      }}
    >
      <Text variant="heading" label={title} />
      {hostLabel !== null ? (
        <Text sx={{ color: 'textSecondary' }} label={hostLabel} />
      ) : null}
      <Text sx={{ color: 'textSecondary' }} label={memberLabel} />
      <Text variant="caption" label={<Trans>Preview from invite</Trans>} />
    </Box>
  );
}
