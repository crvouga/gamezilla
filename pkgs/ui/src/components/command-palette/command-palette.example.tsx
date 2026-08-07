import { useState } from 'react';

import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import {
  EllipsisIcon,
  HouseIcon,
  ListChecksIcon,
  PaintbrushIcon,
  WifiIcon,
} from '../icons';
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
  return <Button title="Open command palette" onPress={open} />;
}

function DemoCommands({ onIncrement }: { onIncrement: () => void }) {
  return (
    <>
      <RegisterCommand
        id="demo-increment"
        title="Increment counter"
        category="Demo"
        icon={ListChecksIcon}
        keywords={['add', 'plus', 'count']}
        run={onIncrement}
      />
      <RegisterCommand
        id="demo-async"
        title="Slow async command (1s)"
        subtitle="Shows loading state"
        category="Demo"
        icon={WifiIcon}
        run={async () => {
          await sleep(1000);
        }}
      />
      <RegisterCommand
        id="demo-fail"
        title="Failing command"
        subtitle="Throws after a short delay"
        category="Demo"
        icon={EllipsisIcon}
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
        icon={PaintbrushIcon}
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
        icon={HouseIcon}
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
    </>
  );
}

/**
 * Self-contained showcase: in-memory registry, no global shortcuts (avoids
 * conflicting with the app-level palette when nested under another provider).
 */
export default function CommandPaletteExample() {
  const [count, setCount] = useState(0);
  return (
    <CommandRegistryProvider enableDefaultShortcuts={false}>
      <DemoCommands onIncrement={() => setCount((c) => c + 1)} />
      <ExampleRoot>
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
      </ExampleRoot>
      <CommandPalette />
    </CommandRegistryProvider>
  );
}
