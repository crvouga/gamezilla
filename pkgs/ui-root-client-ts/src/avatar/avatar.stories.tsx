import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './avatar.example';
import { Avatar } from './index';

const meta = {
  id: 'components-data-display-avatar',
  title: 'Atoms/Avatar',
  component: Avatar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
