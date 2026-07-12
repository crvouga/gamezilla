import { Box } from '../box';
import { IconButton } from '../icon-button';
import { SettingsIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';

export default function TooltipExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Tooltip" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover icon buttons to see their labels."
      />
      <Stack direction="horizontal" spacing={4} align="center">
        <IconButton label="Settings" background="surface" onPress={() => {}}>
          <SettingsIcon size={18} />
        </IconButton>
      </Stack>
    </Box>
  );
}
