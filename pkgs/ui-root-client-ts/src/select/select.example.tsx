/** @jsxImportSource solid-js */

import { Select } from '@pkgs/ui-root-client-ts/select';
import type { SelectOption } from '@pkgs/ui-root-shared-ts/select-types';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const SWATCH = {
  tint: 'bg-tint',
  success: 'bg-success',
  warning: 'bg-warning',
} as const;

function Swatch(props: { tone: keyof typeof SWATCH }): JSX.Element {
  return <div class={`box h-7 w-7 rounded-sm ${SWATCH[props.tone]}`} />;
}

/** Built inside the component: `preview` is JSX and needs the theme context. */
function previewOptions(): readonly SelectOption[] {
  return [
    { value: 'a', label: 'Alpha', preview: <Swatch tone="tint" /> },
    { value: 'b', label: 'Bravo', preview: <Swatch tone="success" /> },
    { value: 'c', label: 'Charlie', preview: <Swatch tone="warning" /> },
  ];
}

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
  const [preview, setPreview] = createSignal('a');
  const PREVIEWS = previewOptions();

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

        <Select
          label="With preview thumbs"
          options={PREVIEWS}
          value={preview()}
          onValueChange={setPreview}
        />

        <Select
          label="Searchable"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          searchable
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
