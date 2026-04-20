import { useState } from 'react';

import { Box } from '../box';
import { Button } from '../button';
import { Stack } from '../stack';
import { Text } from '../text';
import {
  CommandPalette,
  CommandRegistryProvider,
  RegisterCommand,
} from './index';
import { useCommandPalette } from './use-command-palette';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function OpenPaletteButton() {
  const { open } = useCommandPalette();
  return <Button title="Open command palette" onPressIn={open} />;
}

/**
 * Self-contained showcase: in-memory registry, no global shortcuts (avoids
 * conflicting with the app-level palette when nested under another provider).
 */
export default function CommandPaletteExample() {
  const [count, setCount] = useState(0);

  return (
    <CommandRegistryProvider enableDefaultShortcuts={false}>
      <RegisterCommand
        id="demo-increment"
        title="Increment counter"
        category="Demo"
        icon="checklist"
        keywords={['add', 'plus', 'count']}
        run={() => {
          setCount((c) => c + 1);
        }}
      />
      <RegisterCommand
        id="demo-async"
        title="Slow async command (1s)"
        subtitle="Shows loading state"
        category="Demo"
        icon="wifi"
        run={async () => {
          await sleep(1000);
        }}
      />
      <RegisterCommand
        id="demo-fail"
        title="Failing command"
        subtitle="Throws after a short delay"
        category="Demo"
        icon="ellipsis"
        run={async () => {
          await sleep(200);
          throw new Error('simulated failure');
        }}
      />
      <RegisterCommand
        id="demo-shortcut"
        title="Shortcut demo"
        subtitle="Bind mod+shift+d on web in the app shell"
        category="Demo"
        icon="paintbrush.fill"
        shortcut="mod+shift+d"
        run={async () => {
          await sleep(300);
        }}
      />
      <RegisterCommand
        id="demo-rich"
        title="Search me by keyword"
        subtitle="Rich metadata row"
        category="Spotlight"
        icon="house.fill"
        keywords={['fuzzy', 'metadata', 'group']}
        run={async () => {
          await sleep(150);
        }}
      />
      <RegisterCommand
        id="demo-disabled"
        title="Disabled command"
        category="Demo"
        enabled={false}
        run={async () => {
          await sleep(100);
        }}
      />

      <Box sx={{ p: 4, gap: 4 }}>
        <Text variant="heading" label="Command palette" />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label="Open via the button below. In the app shell use ⌘K / ⌘⇧P (global shortcuts are disabled in this isolated example)."
        />

        <Stack spacing={2}>
          <Text variant="bodyBold" label={`Counter: ${count}`} />
          <OpenPaletteButton />
        </Stack>

        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label="↑ ↓ navigate · Enter run · Esc close · Tab next"
        />
      </Box>

      <CommandPalette />
    </CommandRegistryProvider>
  );
}
