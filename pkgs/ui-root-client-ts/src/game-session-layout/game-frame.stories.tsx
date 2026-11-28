import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-frame.example';
import { GameSessionLayout } from './index';

const meta = {
  id: 'templates-game-frame',
  title: 'Templates/Games/GameFrame',
  component: GameSessionLayout,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
