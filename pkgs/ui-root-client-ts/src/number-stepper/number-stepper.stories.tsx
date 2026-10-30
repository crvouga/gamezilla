import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberStepper } from './index';
import Example from './number-stepper.example';

const meta = {
  title: 'Components/Inputs/NumberStepper',
  component: NumberStepper,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
