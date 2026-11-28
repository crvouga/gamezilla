import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TabBar } from './index';
import Example from './tab-bar.example';

const meta = {
  id: 'layouts-tabbar',
  title: 'Organisms/TabBar',
  component: TabBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
