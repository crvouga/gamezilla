/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { StatusDot, type StatusDotStatus } from './status-dot';

const ROWS: readonly { status: StatusDotStatus; label: string }[] = [
  { status: 'online', label: 'Online' },
  { status: 'offline', label: 'Offline' },
  { status: 'warning', label: 'Warning' },
  { status: 'pending', label: 'Pending' },
];

export default function StatusDotExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Stack spacing={3}>
        <For each={ROWS}>
          {(row) => (
            <Stack direction="horizontal" spacing={2} align="center">
              <StatusDot status={row.status} />
              <Text variant="label" label={row.label} />
            </Stack>
          )}
        </For>

        <Stack direction="horizontal" spacing={2} align="center">
          <StatusDot status="online" size={16} />
          <Text variant="label" label="Large (16px)" />
        </Stack>
      </Stack>
    </ExampleRoot>
  );
}
