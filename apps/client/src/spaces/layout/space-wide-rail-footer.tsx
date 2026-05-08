import { SpaceSessionChromeActions } from '@gamezilla/client/spaces/layout/space-session-chrome-actions';
import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import { Box, IconButton, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export function SpaceWideRailFooter() {
  const { t } = useLingui();
  const theme = useTheme();
  const { onPressDebug } = useSpaceSessionUi();

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
        <SpaceSessionChromeActions compact={false} />
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
