/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandPaletteTrigger } from '@pkgs/ui-root-client-ts/command-palette-trigger';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import {
  EllipsisIcon,
  HouseIcon,
  ListChecksIcon,
  PaintbrushIcon,
  WifiIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

function DemoCommands(props: { onIncrement: () => void }): JSX.Element {
  const timers = useTimers();
  const sleep = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
  const failAfterDelay = async (): Promise<void> => {
    await sleep(200);
    throw new Error('simulated failure');
  };
  return (
    <>
      <RegisterCommand
        id="demo-increment"
        title="Increment counter"
        category="Demo"
        icon={ListChecksIcon}
        keywords={['add', 'plus', 'count']}
        run={() => props.onIncrement()}
      />
      <RegisterCommand
        id="demo-async"
        title="Slow async command (1s)"
        subtitle="Shows loading state"
        category="Demo"
        icon={WifiIcon}
        run={() => sleep(1000)}
      />
      <RegisterCommand
        id="demo-fail"
        title="Failing command"
        subtitle="Throws after a short delay"
        category="Demo"
        icon={EllipsisIcon}
        run={failAfterDelay}
      />
      <RegisterCommand
        id="demo-shortcut"
        title="Shortcut demo"
        subtitle="Bind mod+shift+d on web in the app shell"
        category="Demo"
        icon={PaintbrushIcon}
        shortcut="mod+shift+d"
        run={() => sleep(300)}
      />
      <RegisterCommand
        id="demo-rich"
        title="Search me by keyword"
        subtitle="Rich metadata row"
        category="Spotlight"
        icon={HouseIcon}
        keywords={['fuzzy', 'metadata', 'group']}
        run={() => sleep(150)}
      />
      <RegisterCommand
        id="demo-disabled"
        title="Disabled command"
        category="Demo"
        enabled={false}
        run={() => sleep(100)}
      />
    </>
  );
}

/**
 * Self-contained showcase: in-memory registry, no global shortcuts (avoids
 * conflicting with the app-level palette when nested under another provider).
 * Timers come from the ambient `ClockProvider` mounted by the host app.
 */
export default function CommandPaletteExample(): JSX.Element {
  const [count, setCount] = createSignal(0);
  return (
    <CommandRegistryProvider enableDefaultShortcuts={false}>
      <DemoCommands onIncrement={() => setCount((c) => c + 1)} />
      <ExampleRoot>
        <p class="text textCaption text-text-secondary">
          {
            'Open via the button below. In the app shell use ⌘K / ⌘⇧P (global shortcuts are disabled in this isolated example).'
          }
        </p>
        <div class="box flex-col gap-2">
          <p class="text textBodyBold">{`Counter: ${count()}`}</p>
          <CommandPaletteTrigger />
        </div>
        <p class="text textCaption text-text-secondary">
          {'↑ ↓ navigate · Enter run · Esc close · Tab next'}
        </p>
      </ExampleRoot>
      <CommandPalette />
    </CommandRegistryProvider>
  );
}
