import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-frame.example';
import { GameSessionLayout } from './index';

const meta = {
  title: 'Templates/Game frame',
  component: GameSessionLayout,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
