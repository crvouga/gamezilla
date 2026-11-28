import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleScreen } from './index';
import Example from './puzzle-screen.example';

const meta = {
  id: 'templates-puzzle-play',
  title: 'Templates/Games/GamePuzzleScreen',
  component: PuzzleScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
