import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Tooltip } from './index';
import Example from './tooltip.example';

const meta = {
  id: 'components-inputs-tooltip',
  title: 'Molecules/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
