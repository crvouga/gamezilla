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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
