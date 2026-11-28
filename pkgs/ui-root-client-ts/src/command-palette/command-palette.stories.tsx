import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './command-palette.example';
import { CommandPalette } from './index';

const meta = {
  id: 'components-overlay-commandpalette',
  title: 'Organisms/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
