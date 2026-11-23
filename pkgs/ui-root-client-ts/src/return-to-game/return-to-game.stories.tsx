import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ReturnToGame } from './index';
import Example from './return-to-game.example';

const meta = {
  id: 'organisms-returntogame',
  title: 'Organisms/ReturnToGame',
  component: ReturnToGame,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Docked and inline, short and long, from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
