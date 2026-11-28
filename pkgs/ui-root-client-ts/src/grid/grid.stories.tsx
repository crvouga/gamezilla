import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './grid.example';
import { Grid } from './index';

const meta = {
  id: 'primitives-grid',
  title: 'Atoms/Grid',
  component: Grid,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
