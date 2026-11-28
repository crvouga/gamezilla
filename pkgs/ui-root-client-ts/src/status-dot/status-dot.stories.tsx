import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StatusDot } from './index';
import Example from './status-dot.example';

const meta = {
  id: 'components-data-display-statusdot',
  title: 'Atoms/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
