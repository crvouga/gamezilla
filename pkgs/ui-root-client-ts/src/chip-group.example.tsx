/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import type { ChipGroupOption } from './chip-group';
import { ChipGroup } from './chip-group';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';

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
      <SchemePreview>
        <div class="box gap-4">
          <ChipGroup<Intensity>
            label="Intensity"
            options={OPTIONS}
            selected={value()}
            onSelect={setValue}
          />
          <p class="text textCaption">{`Selected: ${value()}`}</p>
          <ChipGroup<Intensity>
            label="Disabled"
            options={OPTIONS}
            selected="high"
            onSelect={() => undefined}
            disabled
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
