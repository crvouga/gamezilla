/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { StatusIconSlot } from '@pkgs/ui-root-client-ts/status-icon-slot';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

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
