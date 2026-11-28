import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-screen.example';
import { GameScreen } from './index';

const meta = {
  id: 'templates-game-session',
  title: 'Templates/Games/GameScreen',
  component: GameScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
