import { Trans } from '@lingui/solid/macro';
import { Box, borderRadius, StatusDot, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

/** Static "Live" pill (no props — miniplayer entries are always live). */
export function MiniplayerLiveBadge(): JSX.Element {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: 'onTintScrim',
        borderRadius: borderRadius.full,
        px: 2,
        py: 0.5,
      }}
    >
      <StatusDot status="online" size={6} />
      <Text
        variant="caption"
        sx={{ color: 'onPrimary' }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}
