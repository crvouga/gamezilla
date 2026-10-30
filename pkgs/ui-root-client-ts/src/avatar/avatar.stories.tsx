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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
