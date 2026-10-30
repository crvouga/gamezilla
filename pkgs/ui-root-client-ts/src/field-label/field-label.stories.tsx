import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './field-label.example';
import { FieldLabel } from './index';

const meta = {
  id: 'primitives-fieldlabel',
  title: 'Atoms/FieldLabel',
  component: FieldLabel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
