import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './avatar-group.example';
import { AvatarGroup } from './index';

const meta = {
  id: 'components-data-display-avatargroup',
  title: 'Molecules/AvatarGroup',
  component: AvatarGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
