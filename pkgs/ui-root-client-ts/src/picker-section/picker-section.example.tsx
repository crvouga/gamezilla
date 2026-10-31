/** @jsxImportSource solid-js */

import { ChipGroup } from '@pkgs/ui-root-client-ts/chip-group';
import { PickerSection } from '@pkgs/ui-root-client-ts/picker-section';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

type Mood = 'a' | 'b';

const OPTIONS = [
  { key: 'a' as const, label: 'Alpha' },
  { key: 'b' as const, label: 'Beta' },
];

export default function PickerSectionExample(): JSX.Element {
  const [v, setV] = createSignal<Mood>('a');

  return (
    <ExampleRoot>
      <PickerSection
        label="Mood"
        description="Wraps any inline picker with consistent label spacing."
      >
        <ChipGroup<Mood> options={OPTIONS} selected={v()} onSelect={setV} />
      </PickerSection>
    </ExampleRoot>
  );
}
