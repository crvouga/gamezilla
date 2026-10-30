/** @jsxImportSource solid-js */

import { MultiSelectSwatchGrid } from '@pkgs/ui-root-client-ts/multi-select-swatch-grid';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const PALETTE: readonly string[] = [
  'ff0000',
  '00ff00',
  '0000ff',
  'ffff00',
  'ff00ff',
];

export default function MultiSelectSwatchGridExample(): JSX.Element {
  const [value, setValue] = createSignal<string[]>([...PALETTE]);
  const palette = (): string[] => [...new Set([...PALETTE, ...value()])];

  return (
    <ExampleRoot>
      <MultiSelectSwatchGrid
        label="Colors"
        palette={palette()}
        value={value()}
        onChange={setValue}
        allowTransparent
        defaultPalette={PALETTE}
      />
      <p class="text textCaption opacity-75">{`Selected (${value().length}): ${value().join(', ')}`}</p>
    </ExampleRoot>
  );
}
