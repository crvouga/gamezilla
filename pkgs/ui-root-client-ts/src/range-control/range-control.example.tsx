import { RangeControl } from '@pkgs/ui-root-client-ts/range-control';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function RangeControlExample() {
  const [value, setValue] = createSignal(20);
  return (
    <ExampleRoot>
      <RangeControl
        label="Position"
        min={0}
        max={100}
        value={value()}
        onInput={setValue}
        valueText={`${value()} percent`}
      />
    </ExampleRoot>
  );
}
