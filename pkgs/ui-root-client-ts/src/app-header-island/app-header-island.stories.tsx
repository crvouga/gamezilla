import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './app-header-island.example';
import { AppHeaderIsland } from './index';

const meta = {
  title: 'Layouts/AppHeaderIsland',
  component: AppHeaderIsland,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
