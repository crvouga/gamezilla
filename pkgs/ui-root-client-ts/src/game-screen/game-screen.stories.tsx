import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-screen.example';
import { GameScreen } from './index';

const meta = {
  id: 'templates-custom-game',
  title: 'Games/Shared/Screens/GameScreen',
  component: GameScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
