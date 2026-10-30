import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MiniPlayerDock } from './index';
import Example from './mini-player.example';

const meta = {
  id: 'layouts-miniplayerdock',
  title: 'Organisms/MiniPlayerDock',
  component: MiniPlayerDock,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
