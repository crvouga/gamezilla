import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './form.example';
import { Form } from './index';

const meta = {
  title: 'Components/Inputs/Form',
  component: Form,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
