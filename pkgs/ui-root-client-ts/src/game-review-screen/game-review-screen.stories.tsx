import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-review-screen.example';
import { GameReviewScreen } from './index';

const meta = {
  id: 'templates-game-and-puzzle-review',
  title: 'Games/Shared/Screens/GameReviewScreen',
  component: GameReviewScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
