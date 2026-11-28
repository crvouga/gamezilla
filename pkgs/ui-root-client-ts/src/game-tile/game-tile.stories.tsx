import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-tile.example';
import { GameTile } from './index';

const meta = {
  id: 'games-shared-game-tile',
  title: 'Organisms/Games/Shared/GameTile',
  component: GameTile,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Every motif at row, name and card-face size, and the title lockup. */
export const Motifs: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
