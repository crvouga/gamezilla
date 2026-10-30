import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-review-screen.example';
import { GameReviewScreen } from './index';

const meta = {
  title: 'Templates/Game and puzzle review',
  component: GameReviewScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
