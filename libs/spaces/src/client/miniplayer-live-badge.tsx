import { Box, StatusDot, Text } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/* eslint-disable lingui/no-unlocalized-strings -- color tokens, not user-facing copy */
const BADGE_BG = 'rgba(255,255,255,0.22)';
const TITLE_COLOR = '#FFFFFF';
/* eslint-enable lingui/no-unlocalized-strings */

/** Static "Live" pill (no props — miniplayer entries are always live). */
export function MiniplayerLiveBadge(): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: BADGE_BG,
        borderRadius: 999,
        px: 2,
        py: 0.5,
      }}
    >
      <StatusDot status="online" size={6} />
      <Text
        variant="caption"
        sx={{ color: TITLE_COLOR }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}
