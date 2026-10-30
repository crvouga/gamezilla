import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TabBar } from './index';
import Example from './tab-bar.example';

const meta = {
  title: 'Layouts/TabBar',
  component: TabBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
