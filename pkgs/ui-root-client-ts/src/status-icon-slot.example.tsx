/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Button } from './button';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { WifiOffIcon } from './icons';
import { StackHorizontal } from './stack';
import { StatusIconSlot } from './status-icon-slot';
import { Surface } from './surface';
import { P } from './text';

export default function StatusIconSlotExample(): JSX.Element {
  const [offline, setOffline] = createSignal(true);
  return (
    <ExampleRoot>
      <ExampleSection title="The slot keeps its room while the status is gone">
        <Surface tone="surface" radius="control" padding="sm">
          <StackHorizontal align="center" gap="sm">
            <P variant="label">{'Header'}</P>
            <StatusIconSlot
              shown={offline()}
              icon={WifiOffIcon}
              label="The host is offline."
            />
            <P variant="caption">{'Next item never moves'}</P>
          </StackHorizontal>
        </Surface>
        <Button
          title={offline() ? 'Back online' : 'Go offline'}
          size="sm"
          intent="neutral"
          onClick={() => setOffline((value) => !value)}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
