import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TextLink } from './index';
import Example from './text-link.example';

const meta = {
  title: 'Components/Inputs/TextLink',
  component: TextLink,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
