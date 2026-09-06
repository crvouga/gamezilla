/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { MultiSelectSwatchGrid } from './multi-select-swatch-grid';

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
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label={`Selected (${value().length}): ${value().join(', ')}`}
      />
    </ExampleRoot>
  );
}
