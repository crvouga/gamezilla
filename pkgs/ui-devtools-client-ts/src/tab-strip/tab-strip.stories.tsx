import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TabStrip } from './index';
import Example from './tab-strip.example';
export default {
  title: 'Product/Developer tools/TabStrip',
  component: TabStrip,
  tags: ['autodocs'],
} satisfies Meta;
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
