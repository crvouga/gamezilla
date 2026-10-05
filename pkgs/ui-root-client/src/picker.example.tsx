/** @jsxImportSource solid-js */

import type { PickerOption } from '@pkgs/ui-root-shared/picker-types';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { Picker } from './picker';

function Swatch(props: { color: string }): JSX.Element {
  return (
    <div
      class="box w-7 h-7 rounded-card"
      style={{ 'background-color': props.color }}
    />
  );
}

/** Built inside the component: `preview` is JSX and needs the theme context. */
function options(): readonly PickerOption[] {
  return [
    { value: 'a', label: 'Alpha', preview: <Swatch color="#c084fc" /> },
    { value: 'b', label: 'Bravo', preview: <Swatch color="#38bdf8" /> },
    { value: 'c', label: 'Charlie', preview: <Swatch color="#4ade80" /> },
  ];
}

export default function PickerExample(): JSX.Element {
  const [v, setV] = createSignal('a');
  const OPTIONS = options();

  return (
    <ExampleRoot>
      <Picker
        label="With preview thumbs"
        options={OPTIONS}
        value={v()}
        onValueChange={setV}
      />
      <p class="text textCaption opacity-75">{`Selected: ${v()}`}</p>
    </ExampleRoot>
  );
}
