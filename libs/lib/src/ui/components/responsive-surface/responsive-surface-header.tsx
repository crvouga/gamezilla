/**
 * Shared header row for {@link ResponsiveSurface} (title + close affordance).
 */

import { Box } from '../box';
import { IconButton } from '../icon-button';
import { Text } from '../text';
import { useTheme } from '../../theme';

export type ResponsiveSurfaceHeaderProps = {
  title: string;
  onClose: () => void;
};

export function ResponsiveSurfaceHeader({
  title,
  onClose,
}: ResponsiveSurfaceHeaderProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
        mt: 1,
        gap: 2,
      }}
    >
      <Text
        variant="subtitle"
        label={title}
        numberOfLines={1}
        style={{ flex: 1, marginRight: 8 }}
      />
      <IconButton size={36} onPress={onClose}>
        <Text
          style={{ fontSize: 18, color: theme.colors.text }}
          label="✕"
        />
      </IconButton>
    </Box>
  );
}
