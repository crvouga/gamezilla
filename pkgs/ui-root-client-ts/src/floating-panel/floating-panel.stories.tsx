import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './floating-panel.example';
import { FloatingPanel } from './index';

const meta = {
  title: 'Components/Overlay/FloatingPanel',
  component: FloatingPanel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
