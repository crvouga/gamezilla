import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Textarea } from './index';
import Example from './textarea.example';

const meta = {
  id: 'components-inputs-textarea',
  title: 'Atoms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
