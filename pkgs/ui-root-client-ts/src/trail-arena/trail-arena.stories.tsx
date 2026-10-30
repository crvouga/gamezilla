import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TrailArena } from './index';
import Example from './trail-arena.example';

const meta = {
  title: 'Components/Inputs/TrailArena',
  component: TrailArena,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
