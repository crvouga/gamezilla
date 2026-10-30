import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './floating-action-button.example';
import { FloatingActionButton } from './index';

const meta = {
  title: 'Components/Inputs/FloatingActionButton',
  component: FloatingActionButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
