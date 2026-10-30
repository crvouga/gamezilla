import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TextInput } from './index';
import Example from './text-input.example';

const meta = {
  title: 'Components/Inputs/TextInput',
  component: TextInput,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
