import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-tile.example';
import { GameTile } from './index';

const meta = {
  id: 'games-shared-game-tile',
  title: 'Games/Shared/Components/GameTile',
  component: GameTile,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Every motif in both schemes, at row and menu size, and the title lockup. */
export const Motifs: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
