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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
