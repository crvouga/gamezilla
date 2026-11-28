import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './brand-icon.example';
import { BrandIcon } from './index';

const meta = {
  id: 'components-icons-brandicon',
  title: 'Atoms/BrandIcon',
  component: BrandIcon,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
