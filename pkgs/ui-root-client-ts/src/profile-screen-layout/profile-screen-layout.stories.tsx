import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProfileIdentity } from './index';
import Example from './profile-screen-layout.example';

const meta = {
  id: 'templates-profile',
  title: 'Templates/ProfileScreenLayout',
  component: ProfileIdentity,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
