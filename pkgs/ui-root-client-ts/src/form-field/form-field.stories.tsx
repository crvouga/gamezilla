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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
