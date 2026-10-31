import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MetricStrip } from './index';
import Example from './metric-strip.example';

const meta = {
  id: 'components-data-display-metricstrip',
  title: 'Molecules/MetricStrip',
  component: MetricStrip,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
