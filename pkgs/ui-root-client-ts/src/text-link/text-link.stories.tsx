import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TextLink } from './index';
import Example from './text-link.example';

const meta = {
  id: 'components-inputs-textlink',
  title: 'Atoms/TextLink',
  component: TextLink,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
