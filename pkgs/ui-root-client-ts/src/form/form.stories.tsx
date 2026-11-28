import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './form.example';
import { Form } from './index';

const meta = {
  id: 'components-inputs-form',
  title: 'Organisms/Form',
  component: Form,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
