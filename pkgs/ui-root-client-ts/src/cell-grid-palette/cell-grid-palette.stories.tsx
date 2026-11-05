import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './cell-grid-palette.example';
import { CellGridPalette } from './index';

const meta = {
  id: 'components-inputs-cellgridpalette',
  title: 'Molecules/CellGridPalette',
  component: CellGridPalette,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** A builder's tools as swatches of their squares; the chosen one marked. */
export const SokobanTools: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** While the builder saves, no tool can be chosen. */
export const Disabled: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example disabled />,
};
