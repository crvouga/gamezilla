import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-setup-panel.example';
import { GameSetupPanel } from './index';

const meta = {
  id: 'templates-game-setup',
  title: 'Templates/Games/GameSetupPanel',
  component: GameSetupPanel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
