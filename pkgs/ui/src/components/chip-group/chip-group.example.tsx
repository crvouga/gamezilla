/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { ChipGroup, type ChipGroupOption } from './chip-group';

type Intensity = 'off' | 'mid' | 'high';

const OPTIONS: readonly ChipGroupOption<Intensity>[] = [
  { key: 'off', label: 'Off' },
  { key: 'mid', label: 'Mid' },
  { key: 'high', label: 'High' },
];

export default function ChipGroupExample(): JSX.Element {
  const [value, setValue] = createSignal<Intensity>('mid');

  return (
    <ExampleRoot>
      <ChipGroup<Intensity>
        label="Intensity"
        options={OPTIONS}
        selected={value()}
        onSelect={setValue}
      />
      <p class="text textCaption opacity-75">{`Selected: ${value()}`}</p>
    </ExampleRoot>
  );
}
