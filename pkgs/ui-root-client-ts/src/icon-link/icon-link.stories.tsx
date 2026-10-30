import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './icon-link.example';
import { IconLink } from './index';

const meta = {
  title: 'Components/Inputs/IconLink',
  component: IconLink,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
