import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MonogramTile } from './index';
import Example from './monogram-tile.example';

const meta = {
  id: 'components-data-display-monogramtile',
  title: 'Atoms/MonogramTile',
  component: MonogramTile,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Every size, and the stable paint each name's seed picks, in both schemes. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
