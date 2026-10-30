import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './grid.example';
import { Grid } from './index';

const meta = {
  title: 'Primitives/Grid',
  component: Grid,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
