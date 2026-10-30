import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProfileIdentity } from './index';
import Example from './profile-screen-layout.example';

const meta = {
  title: 'Templates/Profile',
  component: ProfileIdentity,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
