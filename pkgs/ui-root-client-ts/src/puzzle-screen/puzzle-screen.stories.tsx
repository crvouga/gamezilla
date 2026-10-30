import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleScreen } from './index';
import Example from './puzzle-screen.example';

const meta = {
  id: 'templates-puzzle-play',
  title: 'Games/Shared/Screens/GamePuzzleScreen',
  component: PuzzleScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
