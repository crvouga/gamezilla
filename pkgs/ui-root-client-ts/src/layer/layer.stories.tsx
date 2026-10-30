import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Layer } from './index';
import Example from './layer.example';

const meta = {
  title: 'Layouts/Layer',
  component: Layer,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
