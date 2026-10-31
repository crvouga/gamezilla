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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
