import { Box, IconButton, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

import { SpaceSessionChromeActions } from './space-session-chrome-actions';

export type SpaceWideRailFooterProps = {
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressDebug: () => void;
};

export function SpaceWideRailFooter({
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressDebug,
}: SpaceWideRailFooterProps) {
  const { t } = useLingui();
  const theme = useTheme();

  return (
    <Box
      sx={{
        gap: 2,
        padding: 3,
        borderTopWidth: 1,
        borderColor: 'border',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <SpaceSessionChromeActions
          isHost={isHost}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          compact={false}
        />
      </Box>
      <IconButton
        size={40}
        background="surface"
        onPress={onPressDebug}
        accessibilityLabel={t`Debug`}
      >
        <IconSymbol
          name="chevron.left.forwardslash.chevron.right"
          size={18}
          color={theme.colors.text}
        />
      </IconButton>
    </Box>
  );
}
