import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { CellGridPalette, type CellGridPaletteItem } from './index';

type Tool =
  | 'wall'
  | 'floor'
  | 'goal'
  | 'outside'
  | 'worker'
  | 'crate'
  | 'remove-crate'
  | 'erase';

const TOOLS: readonly CellGridPaletteItem<Tool>[] = [
  { key: 'wall', label: 'Wall', tone: 'occupied' },
  { key: 'floor', label: 'Floor', tone: 'open' },
  { key: 'goal', label: 'Goal', tone: 'open', identity: 'four' },
  { key: 'outside', label: 'Outside', tone: 'quiet', glyph: '·' },
  {
    key: 'worker',
    label: 'Worker',
    tone: 'open',
    glyph: '☻',
    identity: 'three',
  },
  { key: 'crate', label: 'Crate', tone: 'open', glyph: '▢', identity: 'one' },
  {
    key: 'remove-crate',
    label: 'Lift crate',
    tone: 'open',
    glyph: '−',
    identity: 'one',
  },
  { key: 'erase', label: 'Erase', tone: 'open', glyph: '✕' },
];

/** A Sokoban builder's tools, each a swatch of the square it lays down. */
export default function CellGridPaletteExample(props: {
  disabled?: boolean;
}): JSX.Element {
  const [tool, setTool] = createSignal<Tool>('wall');
  return (
    <ExampleRoot>
      <CellGridPalette
        label="Tool"
        boardTheme="sokoban"
        items={TOOLS}
        selected={tool()}
        onSelect={setTool}
        disabled={props.disabled}
      />
    </ExampleRoot>
  );
}
