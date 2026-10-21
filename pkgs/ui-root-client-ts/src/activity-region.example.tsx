/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ActivityRegion } from './activity-region';
import { Button } from './button';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Surface } from './surface';
import { P } from './text';

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
