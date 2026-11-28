import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './icon-link.example';
import { IconLink } from './index';

const meta = {
  id: 'components-inputs-iconlink',
  title: 'Atoms/IconLink',
  component: IconLink,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
