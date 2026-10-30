import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Popover } from './index';
import Example from './popover.example';

const meta = {
  title: 'Components/Overlay/Popover',
  component: Popover,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
