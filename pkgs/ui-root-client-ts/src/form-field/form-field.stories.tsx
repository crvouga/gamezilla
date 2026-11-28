import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './form-field.example';
import { FormField } from './index';

const meta = {
  id: 'components-inputs-formfield',
  title: 'Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
