import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { WordTileBoard } from './index';
import Example from './word-tile-board.example';

const meta = {
  id: 'product-wordtileboard',
  title: 'Games/Word Tiles/Board',
  component: WordTileBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
