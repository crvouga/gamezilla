import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Divider } from './divider';

export default function DividerExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Divider" />

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Horizontal" />
        <Stack spacing={3}>
          <Text variant="body" label="Item above" />
          <Divider />
          <Text variant="body" label="Item below" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Vertical (inside horizontal stack)" />
        <Stack direction="horizontal" spacing={3} align="center" sx={{ height: 40 }}>
          <Text variant="body" label="Left" />
          <Divider orientation="vertical" />
          <Text variant="body" label="Right" />
        </Stack>
      </Box>
    </Box>
  );
}
