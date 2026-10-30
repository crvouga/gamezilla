import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './direction-pad.example';
import { DirectionPad } from './index';

const meta = {
  title: 'Components/Inputs/DirectionPad',
  component: DirectionPad,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
