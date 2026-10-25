import { createSignal, type JSX } from 'solid-js';
import { DirectionPad, type DirectionPadHeading } from './direction-pad';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { P } from './text';

const LABELS = {
  up: 'Steer up',
  right: 'Steer right',
  down: 'Steer down',
  left: 'Steer left',
};

export default function DirectionPadExample(): JSX.Element {
  const [last, setLast] = createSignal<DirectionPadHeading>();
  const [count, setCount] = createSignal(0);
  return (
    <ExampleRoot>
      <ExampleSection title="Enabled: steers on touch, before the finger lifts">
        <DirectionPad
          labels={LABELS}
          disabled={false}
          testId="direction-pad-example"
          onDirection={(heading) => {
            setLast(heading);
            setCount((n) => n + 1);
          }}
        />
        <P role="status" tone="secondary">
          {last() === undefined
            ? 'No direction yet'
            : `Last: ${last()} (${count()} presses)`}
        </P>
      </ExampleSection>
      <ExampleSection title="Disabled: between rounds or while watching">
        <DirectionPad
          labels={LABELS}
          disabled={true}
          testId="direction-pad-example-disabled"
          onDirection={() => undefined}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
