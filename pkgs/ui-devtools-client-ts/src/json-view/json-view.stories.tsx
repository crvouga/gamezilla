import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { JsonView } from './index';
import Example from './json-view.example';
export default {
  title: 'Product/Developer tools/JsonView',
  component: JsonView,
  tags: ['autodocs'],
} satisfies Meta;
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
