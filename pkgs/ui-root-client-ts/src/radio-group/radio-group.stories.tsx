import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RadioGroup } from './index';
import Example from './radio-group.example';

const meta = {
  title: 'Components/Inputs/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
