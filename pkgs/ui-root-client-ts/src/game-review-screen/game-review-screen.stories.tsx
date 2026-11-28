import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-review-screen.example';
import { GameReviewScreen } from './index';

const meta = {
  id: 'templates-game-and-puzzle-review',
  title: 'Templates/Games/GameReviewScreen',
  component: GameReviewScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
