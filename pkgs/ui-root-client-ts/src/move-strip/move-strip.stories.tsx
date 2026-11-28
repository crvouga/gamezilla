import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MoveStrip } from './index';
import Example from './move-strip.example';

const meta = {
  id: 'layouts-movestrip',
  title: 'Organisms/Games/Shared/GameMoveStrip',
  component: MoveStrip,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
