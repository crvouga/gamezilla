import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StatusDot } from './index';
import Example from './status-dot.example';

const meta = {
  title: 'Components/Data Display/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
