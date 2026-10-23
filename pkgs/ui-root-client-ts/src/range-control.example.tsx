import { createSignal } from 'solid-js';
import { ExampleRoot } from './example-root';
import { RangeControl } from './range-control';

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
