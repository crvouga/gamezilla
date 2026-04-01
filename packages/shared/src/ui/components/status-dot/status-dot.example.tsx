import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { StatusDot } from './status-dot';

export default function StatusDotExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">StatusDot</Text>

      <Stack spacing={3}>
        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="online" />
          <Text variant="label">Online</Text>
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="offline" />
          <Text variant="label">Offline</Text>
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="warning" />
          <Text variant="label">Warning</Text>
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="online" size={16} />
          <Text variant="label">Large (16px)</Text>
        </Stack>
      </Stack>
    </Box>
  );
}
