import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './activity-region.example';
import { ActivityRegion } from './index';

const meta = {
  title: 'Layouts/ActivityRegion',
  component: ActivityRegion,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
