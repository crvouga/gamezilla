import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Divider } from './divider';

export default function DividerExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Divider</Text>

      <Box sx={{ gap: 1 }}>
        <Text variant="label">Horizontal</Text>
        <Stack spacing={3}>
          <Text variant="body">Item above</Text>
          <Divider />
          <Text variant="body">Item below</Text>
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label">Vertical (inside horizontal stack)</Text>
        <Stack direction="horizontal" spacing={3} align="center" sx={{ height: 40 }}>
          <Text variant="body">Left</Text>
          <Divider orientation="vertical" />
          <Text variant="body">Right</Text>
        </Stack>
      </Box>
    </Box>
  );
}
