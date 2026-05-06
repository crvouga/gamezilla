import { Box, IconButton, IconSymbol, Text, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export type SpaceWideRailHeaderProps = {
  spaceTitle: string;
  onPressHome: () => void;
};

export function SpaceWideRailHeader({
  spaceTitle,
  onPressHome,
}: SpaceWideRailHeaderProps) {
  const { t } = useLingui();
  const theme = useTheme();

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 2,
        paddingHorizontal: 2,
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
        <Text variant="bodyBold" numberOfLines={1} label={spaceTitle} />
      </Box>
    </Box>
  );
}
