/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Select } from './select';

const FRUITS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Durian', value: 'durian' },
];

const DELAYS = [
  { label: '0 ms', value: 0 },
  { label: '50 ms', value: 50 },
  { label: '150 ms', value: 150 },
  { label: '500 ms', value: 500 },
];

export default function SelectExample(): JSX.Element {
  const [fruit, setFruit] = createSignal('banana');
  const [delay, setDelay] = createSignal(50);

  return (
    <ExampleRoot>
      <div class="box flex-col gap-3">
        <Select
          label="Favorite fruit"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
        />

        <Select<number>
          label="Network delay"
          options={DELAYS}
          value={delay()}
          onValueChange={setDelay}
        />

        <p class="text textCaption text-text-secondary">
          {'Open these to see in-surface status (trigger stays enabled):'}
        </p>

        <Select
          label="Loading"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          loading
        />

        <Select
          label="Error"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          error="ObjectStore HTTP get failed (500): Internal Server Error"
        />

        <Select
          label="Disabled"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          disabled
        />
      </div>
    </ExampleRoot>
  );
}
