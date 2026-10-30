import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './brand-icon.example';
import { BrandIcon } from './index';

const meta = {
  title: 'Components/Icons/BrandIcon',
  component: BrandIcon,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
