import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './element-handles.example';
import { Button } from './index';

const meta = {
  title: 'Primitives/Focus, scroll and measure',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
