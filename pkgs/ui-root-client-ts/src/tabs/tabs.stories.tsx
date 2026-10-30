import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Tabs } from './index';
import Example from './tabs.example';

const meta = {
  title: 'Components/Disclosure/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
