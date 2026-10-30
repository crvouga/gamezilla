import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './badged-icon.example';
import { BadgedIcon } from './index';

const meta = {
  id: 'primitives-badgedicon',
  title: 'Atoms/BadgedIcon',
  component: BadgedIcon,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
