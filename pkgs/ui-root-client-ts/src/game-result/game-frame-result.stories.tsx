import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-frame-result.example';
import { GameResultHeadline } from './index';

const meta = {
  id: 'product-game-frame-game-over',
  title: 'Organisms/Games/Shared/GameResult',
  component: GameResultHeadline,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
