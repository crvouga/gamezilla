import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-frame-setup.example';
import { GamePlayerBar } from './index';

const meta = {
  title: 'Product/Game frame: Setup',
  component: GamePlayerBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
