import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { StatusDot } from './status-dot';

export default function StatusDotExample() {
  return (
    <ExampleRoot>
      <Stack spacing={3}>
        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="online" />
          <Text variant="label" label="Online" />
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="offline" />
          <Text variant="label" label="Offline" />
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="warning" />
          <Text variant="label" label="Warning" />
        </Stack>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="online" size={16} />
          <Text variant="label" label="Large (16px)" />
        </Stack>
      </Stack>
    </ExampleRoot>
  );
}
