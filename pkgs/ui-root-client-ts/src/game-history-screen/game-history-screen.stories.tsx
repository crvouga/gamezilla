import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-history-screen.example';
import { GameHistoryScreen } from './index';

const meta = {
  id: 'templates-game-and-puzzle-history',
  title: 'Games/Shared/Screens/GameHistoryScreen',
  component: GameHistoryScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
