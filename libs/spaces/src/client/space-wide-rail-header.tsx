import { SpaceWideRailTitleText } from './space-wide-rail-title-text';
import { Box, IconButton, IconSymbol, useTheme } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceWideRailHeaderProps = {
  spaceId: string;
  onPressHome: () => void;
};

/** Wide-rail top bar: home button + space title. */
export function SpaceWideRailHeader({
  spaceId,
  onPressHome,
}: SpaceWideRailHeaderProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
        px: 3,
        minHeight: 64,
        borderBottomWidth: 1,
        borderColor: 'border',
      }}
    >
      <IconButton
        size={40}
        background="surface"
        onPress={onPressHome}
        accessibilityLabel={t`Go home`}
      >
        <IconSymbol name="house.fill" size={20} color={theme.colors.text} />
      </IconButton>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SpaceWideRailTitleText spaceId={spaceId} />
      </Box>
    </Box>
  );
}
