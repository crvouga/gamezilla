/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { IconButton } from '../icon-button';
import { SettingsIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';

export default function TooltipExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover icon buttons to see their labels."
      />
      <Stack direction="horizontal" spacing={4} align="center">
        <IconButton
          label="Settings"
          background="surface"
          onClick={() => undefined}
        >
          <SettingsIcon size={18} />
        </IconButton>
      </Stack>
    </ExampleRoot>
  );
}
