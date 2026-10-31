import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-session-layout.example';
import { GameSessionLayout } from './index';

const meta = {
  id: 'templates-matchmaking-game',
  title: 'Games/Shared/Screens/GameSessionLayout',
  component: GameSessionLayout,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
