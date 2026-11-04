import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-move-list.example';
import { GameMoveList } from './index';

const meta = {
  id: 'games-shared-gamemovelist',
  title: 'Games/Shared/Components/GameMoveList',
  component: GameMoveList,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Numbered turns with each mover's swatch, as a strip row and as a table. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
