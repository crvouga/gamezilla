import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Tabs } from './index';
import Example from './tabs.example';

const meta = {
  id: 'components-disclosure-tabs',
  title: 'Organisms/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
