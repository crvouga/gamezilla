import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-setup-panel.example';
import { GameSetupPanel } from './index';

const meta = {
  title: 'Templates/Game setup',
  component: GameSetupPanel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
