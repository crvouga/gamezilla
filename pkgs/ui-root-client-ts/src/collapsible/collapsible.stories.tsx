import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './collapsible.example';
import { Collapsible } from './index';

const meta = {
  id: 'components-disclosure-collapsible',
  title: 'Molecules/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
