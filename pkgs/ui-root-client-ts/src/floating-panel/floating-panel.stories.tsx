import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './floating-panel.example';
import { FloatingPanel } from './index';

const meta = {
  id: 'components-overlay-floatingpanel',
  title: 'Molecules/FloatingPanel',
  component: FloatingPanel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
