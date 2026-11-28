import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './avatar-hero.example';
import { AvatarHero } from './index';

const meta = {
  id: 'components-data-display-avatarhero',
  title: 'Organisms/AvatarHero',
  component: AvatarHero,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
