/** @jsxImportSource solid-js */

import { ActivityRegion } from '@pkgs/ui-root-client-ts/activity-region';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function ActivityRegionExample(): JSX.Element {
  const [presses, setPresses] = createSignal(0);
  return (
    <ExampleRoot>
      <ExampleSection title="Any press inside counts as activity">
        <ActivityRegion onActivity={() => setPresses((n) => n + 1)}>
          <Surface tone="muted" radius="card" padding="lg" gap="sm">
            <P variant="caption">{`Activity seen ${String(presses())} times`}</P>
            <Button title="A control inside" size="sm" intent="neutral" />
          </Surface>
        </ActivityRegion>
      </ExampleSection>
    </ExampleRoot>
  );
}
