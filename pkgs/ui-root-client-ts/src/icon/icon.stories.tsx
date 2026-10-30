import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './icon.example';
import { Icon } from './index';

const meta = {
  id: 'primitives-icon',
  title: 'Atoms/Icon',
  component: Icon,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
